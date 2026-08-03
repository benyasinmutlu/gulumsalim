import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, collections, contentEvents, homepageSections, products, searchQueries, vendors } from "../../db/schema/index";
import { attachPrimaryImages } from "../catalog/catalog.repository";

export type ContentType = "product" | "category" | "collection" | "vendor" | "homepage_section";
export type ContentEventType = "view" | "dwell" | "purchase" | "favorite" | "cart_add";
export type AnalyticsPeriod = "day" | "week" | "month";

// bkz. kullanıcı isteği (2026-08-02): "kategoriler sayfalar koleksiyonlar
// mağazalar kampanyalar ... çok önemli bunlar ... bu datalar kaydedilsin" -
// tek bir ham olay logu (content_events, bkz. db/schema/analytics.ts), TTL
// yok. Önceki turda eklenen Redis günlük sayaçlarının (presence.ts) yerini
// alır - ürün view/dwell/purchase/favorite/cart_add buraya, diğer içerik
// türleri (kategori/koleksiyon/mağaza/anasayfa bölümü) sadece view/dwell'e.
export async function recordContentEvent(contentType: ContentType, contentId: number, eventType: ContentEventType, value = 1): Promise<void> {
  await db.insert(contentEvents).values({ contentType, contentId, eventType, value });
}

// bkz. kullanıcı isteği: "arananlarda bile ... içerik analitiği sayfasında
// gösterilsin" - boş/whitespace sorgular atlanır, karşılaştırma tutarlı
// olsun diye küçük harfe çevrilir (aynı arama "Elbise"/"elbise" tek satırda toplanır).
export async function recordSearchQuery(query: string): Promise<void> {
  const normalized = query.trim().toLocaleLowerCase("tr-TR");
  if (!normalized) return;
  await db.insert(searchQueries).values({ query: normalized });
}

// bkz. kullanıcı isteği: "günlük haftalık aylık" - getAdminSalesTimeSeries'teki
// ("gün başlangıcı" için setHours(0,0,0,0)) aynı desen; hafta/ay kayan
// pencere (takvim haftası/ayı DEĞİL - adil "son N gün" karşılaştırması).
export function dateRangeForPeriod(period: AnalyticsPeriod): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (period === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

export interface ContentEventTotal {
  contentId: number;
  total: number;
  count: number;
}

export async function getContentEventTotals(
  contentType: ContentType,
  eventType: ContentEventType,
  from: Date,
  to: Date,
  limit = 8,
): Promise<ContentEventTotal[]> {
  return db
    .select({
      contentId: contentEvents.contentId,
      total: sql<number>`COALESCE(SUM(${contentEvents.value}), 0)`.mapWith(Number),
      count: count(),
    })
    .from(contentEvents)
    .where(
      and(
        eq(contentEvents.contentType, contentType),
        eq(contentEvents.eventType, eventType),
        gte(contentEvents.createdAt, from),
        lte(contentEvents.createdAt, to),
      ),
    )
    .groupBy(contentEvents.contentId)
    .orderBy(desc(sql`COALESCE(SUM(${contentEvents.value}), 0)`))
    .limit(limit);
}

export async function getTopSearchQueries(from: Date, to: Date, limit = 10): Promise<{ query: string; count: number }[]> {
  return db
    .select({ query: searchQueries.query, count: count() })
    .from(searchQueries)
    .where(and(gte(searchQueries.createdAt, from), lte(searchQueries.createdAt, to)))
    .groupBy(searchQueries.query)
    .orderBy(desc(count()))
    .limit(limit);
}

export interface HydratedContentStat {
  contentId: number;
  name: string;
  subtitle: string | null;
  href: string | null;
  primaryImageUrl: string | null;
  total: number;
  count: number;
}

// getContentEventTotals'ın döndürdüğü {contentId, total, count} satırlarını
// içerik türüne göre isim/görsel/bağlantı ile zenginleştirir - İçerik
// Analitiği sayfasındaki her tablo aynı şekli (HydratedContentStat) kullanır.
export async function hydrateContentStats(contentType: ContentType, rows: ContentEventTotal[]): Promise<HydratedContentStat[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.contentId);
  const statById = new Map(rows.map((r) => [r.contentId, r]));

  if (contentType === "product") {
    const productRows = await db
      .select({ id: products.id, name: products.name, categoryName: categories.name })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(inArray(products.id, ids));
    const withImages = await attachPrimaryImages(productRows);
    return withImages.flatMap((p) => {
      const stat = statById.get(p.id);
      if (!stat) return [];
      return [{ contentId: p.id, name: p.name, subtitle: p.categoryName, href: null, primaryImageUrl: p.primaryImageUrl, total: stat.total, count: stat.count }];
    });
  }

  if (contentType === "category") {
    const rows2 = await db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).where(inArray(categories.id, ids));
    return rows2.flatMap((c) => {
      const stat = statById.get(c.id);
      if (!stat) return [];
      return [{ contentId: c.id, name: c.name, subtitle: null, href: `/${c.slug}`, primaryImageUrl: null, total: stat.total, count: stat.count }];
    });
  }

  if (contentType === "collection") {
    const rows2 = await db
      .select({ id: collections.id, name: collections.name, slug: collections.slug, vendorSlug: vendors.storeSlug, vendorName: vendors.storeName })
      .from(collections)
      .innerJoin(vendors, eq(collections.vendorId, vendors.id))
      .where(inArray(collections.id, ids));
    return rows2.flatMap((c) => {
      const stat = statById.get(c.id);
      if (!stat) return [];
      return [{ contentId: c.id, name: c.name, subtitle: c.vendorName, href: `/${c.vendorSlug}/koleksiyon/${c.slug}`, primaryImageUrl: null, total: stat.total, count: stat.count }];
    });
  }

  if (contentType === "vendor") {
    const rows2 = await db.select({ id: vendors.id, name: vendors.storeName, slug: vendors.storeSlug, logo: vendors.logo }).from(vendors).where(inArray(vendors.id, ids));
    return rows2.flatMap((v) => {
      const stat = statById.get(v.id);
      if (!stat) return [];
      return [{ contentId: v.id, name: v.name, subtitle: null, href: `/${v.slug}`, primaryImageUrl: v.logo, total: stat.total, count: stat.count }];
    });
  }

  // homepage_section
  const rows2 = await db.select({ id: homepageSections.id, title: homepageSections.title }).from(homepageSections).where(inArray(homepageSections.id, ids));
  return rows2.flatMap((s) => {
    const stat = statById.get(s.id);
    if (!stat) return [];
    return [{ contentId: s.id, name: s.title, subtitle: null, href: null, primaryImageUrl: null, total: stat.total, count: stat.count }];
  });
}
