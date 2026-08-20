import { and, count, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, orderItems, orders, productFavorites, products, vendors } from "../../db/schema/index";

// bkz. admin-content.repository.ts getPromoBannerStats ve
// vendor-promo-banners.repository.ts getVendorBannerStats - bir bannerın
// "kategori"/"mağaza"ya bağlı olup olmadığını çözüp, o kapsamdaki ürün/
// favori/satış rakamlarını hesaplar. İkisi de AYNI mantığı kullanır, tek
// yerde tutulur.
export async function resolveBannerScope(banner: {
  linkType: string | null;
  linkUrl: string | null;
}): Promise<{ label: string; productCount: number; favoriteCount: number; purchaseCount: number } | null> {
  let scopeCategoryId: number | null = null;
  let scopeVendorId: number | null = null;
  let scopeLabel = "";

  if (banner.linkType === "category" && banner.linkUrl) {
    const [row] = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.slug, banner.linkUrl)).limit(1);
    if (row) {
      scopeCategoryId = row.id;
      scopeLabel = row.name;
    }
  } else if (banner.linkType === "vendor" && banner.linkUrl) {
    const [row] = await db.select({ id: vendors.id, name: vendors.storeName }).from(vendors).where(eq(vendors.storeSlug, banner.linkUrl)).limit(1);
    if (row) {
      scopeVendorId = row.id;
      scopeLabel = row.name;
    }
  }

  if (scopeCategoryId === null && scopeVendorId === null) return null;

  const productFilter = scopeCategoryId !== null ? eq(products.categoryId, scopeCategoryId) : eq(products.vendorId, scopeVendorId!);
  const [productCountRow] = await db.select({ count: count() }).from(products).where(productFilter);
  const [favoriteRow] = await db
    .select({ count: count() })
    .from(productFavorites)
    .innerJoin(products, eq(productFavorites.productId, products.id))
    .where(productFilter);
  const [purchaseRow] = await db
    .select({ count: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(and(productFilter, eq(orders.paymentStatus, "paid")));

  return {
    label: scopeLabel,
    productCount: productCountRow?.count ?? 0,
    favoriteCount: favoriteRow?.count ?? 0,
    purchaseCount: purchaseRow?.count ?? 0,
  };
}
