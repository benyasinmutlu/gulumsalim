import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import {
  categories,
  homepageCollectionProducts,
  homepageCollections,
  pages,
  promoBanners,
  settings,
  sliders,
  vendors,
} from "../../db/schema/index";
import { findProductsByIds } from "../catalog/catalog.repository";

// Footer/site iletişim bilgisi gibi herkese açık ayarlar için: settings
// tablosundaki her şeyi değil, sadece istenen (izin verilen) anahtarları
// döner - ileride gizli/hassas bir ayar eklenirse yanlışlıkla dışarı sızmaz.
export async function getPublicSettings(keys: string[]) {
  if (keys.length === 0) return {};
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function findPublicPageBySlug(slug: string) {
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return row ?? null;
}

export async function listFooterPages() {
  return db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(eq(pages.showInFooter, true))
    .orderBy(pages.sortOrder);
}

export async function listActiveSliders() {
  return db.select().from(sliders).where(eq(sliders.isActive, true)).orderBy(sliders.sortOrder);
}

export async function listActivePromoBanners() {
  return db
    .select()
    .from(promoBanners)
    .where(and(eq(promoBanners.isActive, true), eq(promoBanners.status, "approved")))
    .orderBy(promoBanners.sortOrder);
}

async function resolveCollectionLink(linkType: string | null, linkValue: string | null): Promise<string | null> {
  if (!linkType || !linkValue) return null;
  if (linkType === "url") return linkValue;
  if (linkType === "category") {
    const [row] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, linkValue)).limit(1);
    return row ? `/kategori/${row.slug}` : null;
  }
  if (linkType === "vendor") {
    const [row] = await db.select({ slug: vendors.storeSlug }).from(vendors).where(eq(vendors.storeSlug, linkValue)).limit(1);
    return row ? `/${row.slug}` : null;
  }
  return null;
}

// gulumsalim.com'daki admin/homepage-collections.php'nin (index.php'deki
// homepageCollectionLink() ile birlikte) karşılığı - admin'in elle kurduğu,
// herhangi bir satıcıdan ürün içerebilen anasayfa vitrinleri. Hiç ürünü
// olmayan bir koleksiyon (ör. tüm ürünleri pasife alınmış) sessizce
// atlanır, tıpkı eski sitedeki `if ($col['items'])` kontrolü gibi.
export async function listActiveHomepageCollections() {
  const rows = await db
    .select()
    .from(homepageCollections)
    .where(eq(homepageCollections.isActive, true))
    .orderBy(homepageCollections.sortOrder);

  const result = [];
  for (const col of rows) {
    const memberships = await db
      .select({ productId: homepageCollectionProducts.productId })
      .from(homepageCollectionProducts)
      .where(eq(homepageCollectionProducts.homepageCollectionId, col.id))
      .orderBy(homepageCollectionProducts.sortOrder);
    if (memberships.length === 0) continue;

    const products = await findProductsByIds(memberships.map((m) => m.productId));
    if (products.length === 0) continue;

    const linkUrl = await resolveCollectionLink(col.linkType, col.linkValue);
    result.push({
      id: col.id,
      title: col.title,
      subtitle: col.subtitle,
      textColor: col.textColor,
      linkUrl,
      products,
    });
  }
  return result;
}
