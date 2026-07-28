import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/client";
import { customers, products, vendors } from "../../../db/schema/index";
import { fetchDiscoverFeed } from "../../discovery/discovery.client";
import type { CatalogProduct } from "./candidates";
import type { ConsentAdapter } from "./runtime";
import {
  deterministicExperiment,
  inMemoryProfileAdapter,
  inMemorySeenAdapter,
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

interface Row {
  productId: number;
  vendorId: number;
  categoryId: number;
  brand: string | null;
  price: string;
  viewCount: number;
  status: "draft" | "active" | "inactive" | "rejected";
  vendorStatus: "pending" | "active" | "suspended" | "banned";
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
    inStock: true, // status ile elenir; variant stok agregasyonu P1
    // Satıcı aktif değilse ürünü delisted say → eligibility filtreler.
    status: r.vendorStatus === "active" ? r.status : "inactive",
    createdAt: r.createdAt.getTime(),
    popularity: Math.min(1, r.viewCount / POPULARITY_VIEW_CAP),
  };
}

const baseSelect = {
  productId: products.id,
  vendorId: products.vendorId,
  categoryId: products.categoryId,
  brand: products.brand,
  price: products.basePrice,
  viewCount: products.viewCount,
  status: products.status,
  vendorStatus: vendors.status,
  createdAt: products.createdAt,
};

export function productionCatalogAdapter(): ProductCatalogAdapter {
  return {
    async byIds(ids: number[]): Promise<CatalogProduct[]> {
      if (ids.length === 0) return [];
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(inArray(products.id, ids));
      return rows.map(toCatalogProduct);
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
      return rows.map(toCatalogProduct);
    },
    async trending(limit: number): Promise<CatalogProduct[]> {
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
        .orderBy(desc(products.viewCount))
        .limit(limit);
      return rows.map(toCatalogProduct);
    },
    async newArrivals(limit: number): Promise<CatalogProduct[]> {
      const rows = await db
        .select(baseSelect)
        .from(products)
        .innerJoin(vendors, eq(products.vendorId, vendors.id))
        .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
        .orderBy(desc(products.createdAt))
        .limit(limit);
      return rows.map(toCatalogProduct);
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

// Collaborative aggregate henüz üretimde yok (bkz. collaborative-aggregate-
// production-plan.md) → boş; pipeline diğer kaynaklara + fallback'e düşer.
const emptyCollaborative = { alsoInteracted: async () => [] };

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
export function buildProductionDiscoverRuntime(): DiscoverRuntime {
  return {
    catalog: productionCatalogAdapter(),
    collaborative: emptyCollaborative,
    legacy: productionLegacyAdapter(),
    profile: inMemoryProfileAdapter(),
    seen: inMemorySeenAdapter(),
    experiment: deterministicExperiment(),
    consent: productionConsentAdapter(),
    generateRequestId,
  };
}
