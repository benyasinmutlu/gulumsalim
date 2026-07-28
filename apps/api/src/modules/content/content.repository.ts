import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import {
  categories,
  collections,
  homepageCollectionProducts,
  homepageCollections,
  pages,
  promoBannerClicks,
  promoBannerImages,
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

// admin/promo-banners.php'deki "Ek Görseller (döngü için)" özelliğinin
// karşılığı - ana görsele ek olarak, varsa döngü görselleri de eklenir
// (bkz. components/promo-banner-image.tsx, rotateSeconds ile döner).
export async function listActivePromoBanners() {
  const banners = await db
    .select()
    .from(promoBanners)
    .where(and(eq(promoBanners.isActive, true), eq(promoBanners.status, "approved")))
    .orderBy(promoBanners.sortOrder);
  if (banners.length === 0) return [];

  const ids = banners.map((b) => b.id);
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
  const withExtras = banners.map((b) => ({ ...b, extraImages: byBanner.get(b.id) ?? [] }));
  return Promise.all(
    withExtras.map(async (b) => ({ ...b, resolvedLink: await resolveCollectionLink(b.linkType, b.linkUrl) })),
  );
}

// gulumsalim.com'daki tıklama takibinin karşılığı - bannera tıklanan/
// gösterilen her seferde (giriş yapmış/misafir ayrımı yapılmadan) tek satır
// eklenir, kimlik bilgisi tutulmaz (bkz. admin-content.repository.ts
// getPromoBannerStats, vendor-promo-banners.repository.ts getVendorBannerStats).
export async function recordPromoBannerEvent(bannerId: number, eventType: "view" | "click") {
  await db.insert(promoBannerClicks).values({ bannerId, eventType });
}

export async function resolveCollectionLink(linkType: string | null, linkValue: string | null): Promise<string | null> {
  if (!linkType) return null;
  // "Tüm Mağazalar" tek bir varlığa bağlı değil, linkValue gerektirmez -
  // bkz. kullanıcı isteği: banner/koleksiyon hedefi olarak mağaza listesinin
  // tamamı seçilebilsin.
  if (linkType === "all_vendors") return "/magazalar";
  if (!linkValue) return null;
  if (linkType === "url") return linkValue;
  if (linkType === "category") {
    const [row] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, linkValue)).limit(1);
    return row ? `/kategori/${row.slug}` : null;
  }
  if (linkType === "vendor") {
    const [row] = await db.select({ slug: vendors.storeSlug }).from(vendors).where(eq(vendors.storeSlug, linkValue)).limit(1);
    return row ? `/${row.slug}` : null;
  }
  // Satıcı koleksiyonları mağazaya özel oldugundan (bkz. catalog.ts
  // collections tablosu, uniq_collections_vendor_slug) tek bir slug yeterli
  // değil - linkValue "magazaSlug/koleksiyonSlug" biçiminde saklanır.
  if (linkType === "collection") {
    const [vendorSlug, collectionSlug] = linkValue.split("/");
    if (!vendorSlug || !collectionSlug) return null;
    const [row] = await db
      .select({ vendorSlug: vendors.storeSlug, collectionSlug: collections.slug })
      .from(collections)
      .innerJoin(vendors, eq(collections.vendorId, vendors.id))
      .where(and(eq(vendors.storeSlug, vendorSlug), eq(collections.slug, collectionSlug), eq(collections.isActive, true)))
      .limit(1);
    return row ? `/${row.vendorSlug}/koleksiyon/${row.collectionSlug}` : null;
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
      // bkz. kullanıcı isteği: "buradaki düzen tam olarak anasayfanın
      // sıralama olarak birebir aynısı olmalı" - önceden bu uç sortOrder'ı
      // hiç döndürmüyordu, bu yüzden anasayfa koleksiyonları
      // bölümlerle (homepage_sections) ASLA aynı sırada gösterilemiyordu,
      // her zaman tüm bölümlerden SONRA sabit bir blok olarak geliyordu.
      sortOrder: col.sortOrder,
    });
  }
  return result;
}
