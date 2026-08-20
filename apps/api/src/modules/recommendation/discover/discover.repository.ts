import { and, countDistinct, desc, eq, gt, inArray, min, notInArray, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { contentEvents, customers, discoverFeedback, orderItems, orders, productFavorites, products, productVariants, vendors } from "../../../db/schema/index";
import { fetchDiscoverFeed } from "../../discovery/discovery.client";
import type { CatalogProduct, CollaborativePort } from "./candidates";
import { rankCoOccurrence, type CoOccurrenceRow } from "./collaborative";
import { toFeedbackSets } from "./feedback";
import { buildProfileFromInteractions, expandSizePrefs, FAVORITE_WEIGHT, PURCHASE_WEIGHT, type InteractionRow } from "./profile-builder";
import type { Redis } from "ioredis";
import { getRecentlyViewedProductIds } from "../../../lib/view-history";
import type { ConsentAdapter, CustomerProfileAdapter, SeenHistoryAdapter } from "./runtime";
import {
  deterministicExperiment,
  emptyDiscoverProfile,
  type DiscoverRuntime,
  type LegacyRecommendationAdapter,
  type ProductCatalogAdapter,
} from "./runtime";

// =============================================================================
// Production DB/Go adapters (FAZ 4). DRIZZLE-TYPECHECK edildi ancak CANLI DB'ye
// karşı çalıştırılmadı (Go/DB ortamı yok). Route flag arkasında (varsayılan
// KAPALI) — canlı doğrulama P1 (bkz. production-deployment-gap.md).
//
// NOT (şema drift): products.brand/viewCount schema kodunda var; canlı DB'de
// migration seviyesine bağlı (bkz. migration-drift-decision.md). colorFamily
// ürün seviyesinde YOK (variant.color) → boş; brand-only affinity ile degrade.
// inStock: bu sürümde status'e indirgenir (variant stok agregasyonu P1); satın
// almada gerçek stok checkout transaction'ında zaten zorlanır.
// =============================================================================

const POPULARITY_VIEW_CAP = 1000;
// Zaman-pencereli, conversion-farkında popülerlik/trend (content_events'ten).
const ENGAGEMENT_WINDOW_DAYS = 30;
const ENGAGEMENT_CAP = 60; // ham skoru 0..1'e normalize eden sabit tavan (global, kararlı)
// Olay ağırlıkları: satın alma >> sepete ekleme > favori > görüntüleme > dwell.
const ENGAGEMENT_WEIGHT_SQL = sql`case ${contentEvents.eventType}
  when 'purchase' then 6 when 'cart_add' then 3 when 'favorite' then 4
  when 'view' then 1 when 'dwell' then 0.5 else 0 end`;

interface Row {
  productId: number;
  vendorId: number;
  categoryId: number;
  brand: string | null;
  price: string;
  viewCount: number;
  stock: number;
  status: "draft" | "pending" | "active" | "inactive" | "rejected";
  vendorStatus: "pending" | "active" | "suspended" | "banned" | "closed";
  createdAt: Date;
}

function toCatalogProduct(r: Row): CatalogProduct {
  return {
    productId: r.productId,
    vendorId: r.vendorId,
    categoryId: r.categoryId,
    brand: r.brand ?? "",
    colorFamily: "", // ürün seviyesinde renk yok (variant.color) — brand-only affinity
    price: Number(r.price),
    inStock: r.stock > 0, // ürün-seviye stok; attachStock varyant stoğunu OR'lar
    // Satıcı aktif değilse ürünü delisted say → eligibility filtreler.
    status: r.vendorStatus === "active" ? r.status : "inactive",
    createdAt: r.createdAt.getTime(),
    popularity: Math.min(1, r.viewCount / POPULARITY_VIEW_CAP), // baseline; attachPopularity harmanlar
  };
}

const baseSelect = {
  productId: products.id,
  vendorId: products.vendorId,
  categoryId: products.categoryId,
  brand: products.brand,
  price: products.basePrice,
  viewCount: products.viewCount,
  stock: products.stock,
  status: products.status,
  vendorStatus: vendors.status,
  createdAt: products.createdAt,
};

// P0 — GERÇEK stok: ürün-seviye stok VEYA stoğu >0 olan varyant. inStockSizes
// (sizeFit) da buradan. Stokta olmayan ürün eligibility'de elenir (önerilmez).
async function attachStock(list: CatalogProduct[]): Promise<CatalogProduct[]> {
  if (list.length === 0) return list;
  const ids = list.map((p) => p.productId);
  const rows = await db
    .select({ productId: productVariants.productId, size: productVariants.size })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, ids), gt(productVariants.stock, 0)));
  const sizes = new Map<number, string[]>();
  const hasVariantStock = new Set<number>();
  for (const r of rows) {
    hasVariantStock.add(r.productId);
    if (!r.size) continue;
    const arr = sizes.get(r.productId) ?? [];
    if (!arr.includes(r.size)) arr.push(r.size);
    sizes.set(r.productId, arr);
  }
  for (const p of list) {
    if (hasVariantStock.has(p.productId)) p.inStock = true;
    p.inStockSizes = sizes.get(p.productId) ?? [];
  }
  return list;
}

// content_events son penceresinden ürün başına ağırlıklı etkileşim skoru.
// productIds verilirse o ürünler; null ise en yüksek skorlu top-N (trending).
async function recentEngagement(productIds: number[] | null, limit: number): Promise<{ productId: number; score: number }[]> {
  const since = new Date(Date.now() - ENGAGEMENT_WINDOW_DAYS * 86_400_000);
  const conds = [eq(contentEvents.contentType, "product"), gt(contentEvents.createdAt, since)];
  if (productIds) {
    if (productIds.length === 0) return [];
    conds.push(inArray(contentEvents.contentId, productIds));
  }
  const score = sql<number>`sum(${contentEvents.value} * (${ENGAGEMENT_WEIGHT_SQL}))`;
  const rows = await db
    .select({ productId: contentEvents.contentId, score })
    .from(contentEvents)
    .where(and(...conds))
    .groupBy(contentEvents.contentId)
    .orderBy(desc(score))
    .limit(limit);
  return rows.map((r) => ({ productId: r.productId, score: Number(r.score) }));
}

// P1 — popularity: son-pencere etkileşimi (conversion-farkında) baseline
// viewCount ile harmanlanır (0.7 taze + 0.3 tüm-zaman). Global tavan → kararlı.
async function attachPopularity(list: CatalogProduct[]): Promise<CatalogProduct[]> {
  if (list.length === 0) return list;
  const eng = await recentEngagement(list.map((p) => p.productId), list.length);
  const map = new Map(eng.map((e) => [e.productId, e.score]));
  for (const p of list) {
    const recent = Math.min(1, (map.get(p.productId) ?? 0) / ENGAGEMENT_CAP);
    p.popularity = Math.min(1, 0.7 * recent + 0.3 * p.popularity);
  }
  return list;
}

// Katalog satırlarını CatalogProduct'a çevirip stok + popülerlik zenginleştirir.
async function hydrate(rows: Row[]): Promise<CatalogProduct[]> {
  return attachPopularity(await attachStock(rows.map(toCatalogProduct)));
}

export function productionCatalogAdapter(): ProductCatalogAdapter {
  return {
    async byIds(ids: number[]): Promise<CatalogProduct[]> {
      if (ids.length === 0) return [];
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(inArray(products.id, ids));
      return hydrate(rows);
    },
    async productsByCategories(categoryIds: number[], limit: number): Promise<CatalogProduct[]> {
      if (categoryIds.length === 0) return [];
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(inArray(products.categoryId, categoryIds), eq(products.status, "active"), eq(vendors.status, "active")))
        .orderBy(desc(products.viewCount))
        .limit(limit);
      return hydrate(rows);
    },
    // P1 — trending: son-pencere ağırlıklı etkileşime göre (content_events).
    // Yeterli taze olay yoksa all-time viewCount'a düşer (soğuk başlangıç).
    async trending(limit: number): Promise<CatalogProduct[]> {
      const eng = await recentEngagement(null, limit * 4);
      if (eng.length > 0) {
        const ids = eng.map((e) => e.productId);
        const order = new Map(ids.map((id, i) => [id, i]));
        const rows = await db
          .select(baseSelect)
          .from(products)
          .innerJoin(vendors, eq(products.vendorId, vendors.id))
          .where(and(inArray(products.id, ids), eq(products.status, "active"), eq(vendors.status, "active")));
        rows.sort((a, b) => (order.get(a.productId) ?? 0) - (order.get(b.productId) ?? 0));
        const hydrated = await hydrate(rows);
        if (hydrated.length > 0) return hydrated;
      }
      // Fallback: all-time popüler (taze olay yok / hepsi elendi).
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
        .orderBy(desc(products.viewCount))
        .limit(limit);
      return hydrate(rows);
    },
    async newArrivals(limit: number): Promise<CatalogProduct[]> {
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
        .orderBy(desc(products.createdAt))
        .limit(limit);
      return hydrate(rows);
    },
  };
}

// Kişisel profilin beslendiği kalıcı sinyaller: favoriler + satın almalar.
// Görüntüleme olayları Redis/Go tarafında (per-user Postgres'te yok) → burada
// kalıcı, güçlü niyet sinyalleri kullanılır. Yeni müşteri/veri yoksa boş döner.
const INTERACTION_LIMIT = 200;

async function loadInteractionRows(customerId: number): Promise<InteractionRow[]> {
  const [favs, purchases] = await Promise.all([
    db
      .select({
        productId: products.id,
        vendorId: products.vendorId,
        categoryId: products.categoryId,
        brand: products.brand,
        price: products.basePrice,
        createdAt: productFavorites.createdAt,
      })
      .from(productFavorites)
      .innerJoin(products, eq(productFavorites.productId, products.id))
      .where(eq(productFavorites.customerId, customerId))
      .orderBy(desc(productFavorites.createdAt))
      .limit(INTERACTION_LIMIT),
    db
      .select({
        productId: products.id,
        vendorId: products.vendorId,
        categoryId: products.categoryId,
        brand: products.brand,
        price: orderItems.unitPrice,
        createdAt: orders.createdAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt))
      .limit(INTERACTION_LIMIT),
  ]);

  const rows: InteractionRow[] = [];
  for (const f of favs) {
    rows.push({ productId: f.productId, vendorId: f.vendorId, categoryId: f.categoryId, brand: f.brand, price: Number(f.price), weight: FAVORITE_WEIGHT, createdAt: f.createdAt.getTime() });
  }
  for (const p of purchases) {
    rows.push({ productId: p.productId, vendorId: p.vendorId, categoryId: p.categoryId, brand: p.brand, price: Number(p.price), weight: PURCHASE_WEIGHT, createdAt: p.createdAt.getTime() });
  }
  return rows;
}

// Kullanıcının "İlgilenmiyorum/Gizle" geri bildirimleri → profil setleri.
async function loadNegativeFeedback(customerId: number): Promise<{ hiddenProductIds: Set<number>; notInterestedCategoryIds: Set<number> }> {
  const rows = await db
    .select({ productId: discoverFeedback.productId, categoryId: discoverFeedback.categoryId })
    .from(discoverFeedback)
    .where(eq(discoverFeedback.customerId, customerId));
  return toFeedbackSets(rows);
}

// "İlgilenmiyorum/Gizle" kaydı (idempotent — aynı hedef tekrar eklenmez).
export async function recordDiscoverFeedback(customerId: number, input: { productId?: number; categoryId?: number }): Promise<void> {
  if (input.productId != null) {
    await db.insert(discoverFeedback).values({ customerId, kind: "hide_product", productId: input.productId }).onConflictDoNothing();
  } else if (input.categoryId != null) {
    await db.insert(discoverFeedback).values({ customerId, kind: "not_interested_category", categoryId: input.categoryId }).onConflictDoNothing();
  }
}

// FAZ A: gerçek kişisel profil (favoriler + satın almalardan affinity) + beden
// (sizeFit) + negatif geri bildirim (hidden/notInterested). Boş müşteri/veri →
// nötr profil (soğuk başlangıç, pipeline trend/keşfe düşer).
export function productionProfileAdapter(): CustomerProfileAdapter {
  return {
    async load(req) {
      const customerId = req.customerId;
      if (customerId == null) return emptyDiscoverProfile();
      // Etkileşim (affinity) + beden (sizeFit) + negatif geri bildirim paralel.
      const [rows, sizeRow, negative] = await Promise.all([
        loadInteractionRows(customerId),
        db.select({ sizePrefs: customers.sizePrefs }).from(customers).where(eq(customers.id, customerId)).limit(1),
        loadNegativeFeedback(customerId),
      ]);
      const profile = rows.length > 0 ? buildProfileFromInteractions(rows) : emptyDiscoverProfile();
      profile.sizes = new Set(expandSizePrefs(sizeRow[0]?.sizePrefs));
      profile.hiddenProductIds = negative.hiddenProductIds;
      profile.notInterestedCategoryIds = negative.notInterestedCategoryIds;
      return profile;
    },
  };
}

// Mevcut Go discovery servisini saran gerçek legacy adapter.
export function productionLegacyAdapter(): LegacyRecommendationAdapter {
  return {
    async personalizedProductIds(customerId, limit) {
      const feed = await fetchDiscoverFeed(customerId, limit);
      return feed.productIds;
    },
  };
}

// Collaborative co-occurrence (item-item): "seed ürünleri alan müşteriler başka
// NELERİ aldı". İki adım — (1) seed'i alan müşteriler, (2) o müşterilerin aldığı
// diğer ürünler (distinct müşteri = support). Gizlilik: min-support pure katmanda
// (rankCoOccurrence) zorlanır → tek kullanıcı ifşa edilmez.
async function coOccurrenceRows(seedProductIds: number[], cap: number): Promise<CoOccurrenceRow[]> {
  if (seedProductIds.length === 0) return [];
  const seedCustomers = await db
    .selectDistinct({ customerId: orders.customerId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orderItems.productId, seedProductIds));
  const customerIds = seedCustomers.map((r) => r.customerId);
  if (customerIds.length === 0) return [];

  const rows = await db
    .select({
      productId: orderItems.productId,
      vendorId: min(products.vendorId),
      support: countDistinct(orders.customerId),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(
      and(
        inArray(orders.customerId, customerIds),
        notInArray(orderItems.productId, seedProductIds),
        eq(products.status, "active"),
        eq(vendors.status, "active"),
      ),
    )
    .groupBy(orderItems.productId)
    .orderBy(desc(countDistinct(orders.customerId)))
    .limit(cap);

  return rows.map((r) => ({ productId: r.productId, vendorId: Number(r.vendorId ?? 0), support: Number(r.support) }));
}

export function productionCollaborativeAdapter(): CollaborativePort {
  return {
    async alsoInteracted(seedProductIds, limit) {
      const rows = await coOccurrenceRows(seedProductIds, Math.max(limit * 5, 50));
      return rankCoOccurrence(rows, limit);
    },
  };
}

// Seen/fatigue: yakında görüntülenen ürünler (Redis view-history) → keşifte
// tekrar öne çıkarma. Eligibility bunları eler. Anonim → boş (kişisel geçmiş yok).
const SEEN_LIMIT = 100;
export function productionSeenAdapter(redis: Redis): SeenHistoryAdapter {
  return {
    async load(req) {
      if (req.customerId == null) return new Set();
      const ids = await getRecentlyViewedProductIds(redis, req.customerId, SEEN_LIMIT);
      return new Set(ids);
    },
  };
}

let counter = 0;
function generateRequestId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `disc-${Date.now().toString(36)}-${counter.toString(36)}`;
}

function productionConsentAdapter(): ConsentAdapter {
  return {
    async hasAnalyticsConsent(customerId) {
      if (customerId == null) return false;
      const [row] = await db
        .select({ analyticsConsentAt: customers.analyticsConsentAt })
        .from(customers)
        .where(eq(customers.id, customerId))
        .limit(1);
      return row?.analyticsConsentAt != null;
    },
  };
}

// Production runtime: gerçek katalog + Go legacy + (henüz) in-memory profil/seen.
// Profil persist ve collaborative aggregate bağlanınca ilgili adapter'lar değişir.
export function buildProductionDiscoverRuntime(redis: Redis): DiscoverRuntime {
  return {
    catalog: productionCatalogAdapter(),
    collaborative: productionCollaborativeAdapter(),
    legacy: productionLegacyAdapter(),
    profile: productionProfileAdapter(),
    seen: productionSeenAdapter(redis),
    experiment: deterministicExperiment(),
    consent: productionConsentAdapter(),
    generateRequestId,
  };
}
