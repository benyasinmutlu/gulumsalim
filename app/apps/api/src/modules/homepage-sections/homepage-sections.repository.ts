import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  categories,
  homepageSectionBanners,
  homepageSections,
  orderItems,
  orders,
  pages,
  products,
  promoBannerImages,
  promoBanners,
  vendors,
} from "../../db/schema/index";
import { resolveCollectionLink } from "../content/content.repository";

export async function listActiveSections() {
  return db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.isActive, true))
    .orderBy(homepageSections.sortOrder);
}

export async function listAllSections() {
  return db.select().from(homepageSections).orderBy(homepageSections.sortOrder);
}

export async function findSectionById(id: number) {
  const [row] = await db.select().from(homepageSections).where(eq(homepageSections.id, id)).limit(1);
  return row ?? null;
}

// homepage-sections.php'deki seo_slug tekillik kontrolünün karşılığı - kök
// seviyedeki tüm slug kaynakları (sayfalar/mağazalar/kategoriler/diğer
// bölümler) AYNI ad alanını paylaşır, çakışma olursa admin'e net bir hata
// döner (rastgele bir sonek eklemek yerine - admin URL'i bilerek seçiyor).
export async function isSeoSlugTaken(slug: string, excludeSectionId?: number): Promise<boolean> {
  const [[pageRow], [vendorRow], [catRow], [sectionRow]] = await Promise.all([
    db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1),
    db.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeSlug, slug)).limit(1),
    db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1),
    db
      .select({ id: homepageSections.id })
      .from(homepageSections)
      .where(
        excludeSectionId
          ? and(eq(homepageSections.seoSlug, slug), ne(homepageSections.id, excludeSectionId))
          : eq(homepageSections.seoSlug, slug),
      )
      .limit(1),
  ]);
  return Boolean(pageRow || vendorRow || catRow || sectionRow);
}

// [slug]/page.tsx zincirinin 3. adımı için - sayfa/mağaza eşleşmediğinde
// kök seviyede bu slug'a sahip aktif bir bölüm var mı diye bakılır.
export async function findActiveSectionBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(homepageSections)
    .where(and(eq(homepageSections.seoSlug, slug), eq(homepageSections.isActive, true)))
    .limit(1);
  return row ?? null;
}

// Bölüme özel seçilmiş bannerlar (varsa) - homepage-sections.php'deki
// "Kampanya Bannerları" bölümüne özel banner seçimi. Boş dönerse çağıran
// taraf (resolveHomepageSections) tüm onaylı+aktif bannerlara düşer.
export async function listSectionBanners(sectionId: number) {
  const rows = await db
    .select({
      id: promoBanners.id,
      title: promoBanners.title,
      image: promoBanners.image,
      linkUrl: promoBanners.linkUrl,
      linkType: promoBanners.linkType,
      animStyle: promoBanners.animStyle,
      subtitle: promoBanners.subtitle,
      buttonText: promoBanners.buttonText,
      textColor: promoBanners.textColor,
      rotateSeconds: promoBanners.rotateSeconds,
    })
    .from(homepageSectionBanners)
    .innerJoin(promoBanners, eq(homepageSectionBanners.bannerId, promoBanners.id))
    .where(eq(homepageSectionBanners.sectionId, sectionId))
    .orderBy(asc(homepageSectionBanners.sortOrder));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const images = await db
    .select({ bannerId: promoBannerImages.bannerId, image: promoBannerImages.image })
    .from(promoBannerImages)
    .where(inArray(promoBannerImages.bannerId, ids))
    .orderBy(asc(promoBannerImages.sortOrder));
  const byBanner = new Map<number, string[]>();
  for (const img of images) {
    const list = byBanner.get(img.bannerId) ?? [];
    list.push(img.image);
    byBanner.set(img.bannerId, list);
  }
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      extraImages: byBanner.get(r.id) ?? [],
      resolvedLink: await resolveCollectionLink(r.linkType, r.linkUrl),
    })),
  );
}

export async function addSectionBanner(sectionId: number, bannerId: number) {
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${homepageSectionBanners.sortOrder}), 0)` })
    .from(homepageSectionBanners)
    .where(eq(homepageSectionBanners.sectionId, sectionId));
  const nextOrder = (maxRow?.max ?? 0) + 1;
  await db
    .insert(homepageSectionBanners)
    .values({ sectionId, bannerId, sortOrder: nextOrder })
    .onConflictDoNothing({ target: [homepageSectionBanners.sectionId, homepageSectionBanners.bannerId] });
}

export async function removeSectionBanner(sectionId: number, bannerId: number) {
  await db
    .delete(homepageSectionBanners)
    .where(and(eq(homepageSectionBanners.sectionId, sectionId), eq(homepageSectionBanners.bannerId, bannerId)));
}

export async function reorderSectionBanners(sectionId: number, bannerIds: number[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < bannerIds.length; i++) {
      await tx
        .update(homepageSectionBanners)
        .set({ sortOrder: i })
        .where(and(eq(homepageSectionBanners.sectionId, sectionId), eq(homepageSectionBanners.bannerId, bannerIds[i]!)));
    }
  });
}

export async function insertSection(data: {
  title: string;
  algoType: (typeof homepageSections.$inferInsert)["algoType"];
  config: Record<string, unknown>;
  sortOrder: number;
  seoSlug?: string;
}) {
  const [row] = await db.insert(homepageSections).values(data).returning();
  if (!row) throw new Error("Bölüm oluşturulamadı");
  return row;
}

export async function updateSection(
  id: number,
  data: Partial<{
    title: string;
    algoType: (typeof homepageSections.$inferInsert)["algoType"];
    config: Record<string, unknown>;
    sortOrder: number;
    isActive: boolean;
    seoSlug: string | null;
  }>,
) {
  const [row] = await db.update(homepageSections).set(data).where(eq(homepageSections.id, id)).returning();
  return row ?? null;
}

export async function deleteSection(id: number) {
  const result = await db.delete(homepageSections).where(eq(homepageSections.id, id)).returning({ id: homepageSections.id });
  return result.length > 0;
}

// "En çok satan" hesaplaması: order_items.quantity toplamı, sadece ödemesi
// tamamlanmış siparişlerden. weekly_best için orders.createdAt son 7 günle
// sınırlanır, best_sellers için sınırsız (tüm zamanlar).
export async function computeBestSellingProductIds(limit: number, sinceDays?: number): Promise<number[]> {
  const conditions = [eq(orders.paymentStatus, "paid")];
  if (sinceDays !== undefined) {
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(orders.createdAt, cutoff));
  }

  const rows = await db
    .select({ productId: orderItems.productId, totalQty: sql<number>`SUM(${orderItems.quantity})`.as("total_qty") })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`total_qty`))
    .limit(limit);

  return rows.map((r) => r.productId);
}

// products tablosuna doğrudan erişim gereken (basit) yardımcılar - diğer
// modüllerin repository'lerini gereksiz yere çapraz import etmemek için
// burada tutuluyor.
export async function findNewArrivalProductIds(limit: number): Promise<number[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}
