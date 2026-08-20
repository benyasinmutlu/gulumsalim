import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  categories,
  channelListings,
  collectionProducts,
  discoverEvents,
  discoverFeedback,
  fitFeedback,
  homepageCollectionProducts,
  orderItems,
  productFavorites,
  productImages,
  productQuestions,
  productReviews,
  productVariants,
  products,
  stockSyncOutbox,
  vendors,
} from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

interface ListParams {
  status?: "draft" | "pending" | "active" | "inactive" | "rejected";
  search?: string;
  vendorId?: number;
  categoryId?: number;
  stock?: "low" | "out";
}

// products.php'deki stok/kategori filtrelerinin ve resim/favori/görüntülenme
// sütunlarının karşılığı - varyantı olan üründe stok product_variants'ta
// (SUM(stock)), varyantsız üründe products.stock'ta tutulur (bkz. aşağıdaki
// effectiveStock).
export async function listAllProducts({ status, search, vendorId, categoryId, stock }: ListParams) {
  const conditions = [];
  if (status) conditions.push(eq(products.status, status));
  if (vendorId) conditions.push(eq(products.vendorId, vendorId));
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli bireysel satıcıların ise stoğu 1 olacak" -
  // varyantı olan üründe stok variant toplamı, varyantsız üründe artık
  // products.stock (eskiden varyantsız ürünlerde stok kavramı hiç yoktu ve
  // filtrelere hiç dahil edilmiyorlardı, bkz. eski yorum aşağıda).
  const hasAnyVariant = sql<boolean>`EXISTS (SELECT 1 FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)})`;
  const effectiveStock = sql<number>`(CASE WHEN ${hasAnyVariant} THEN COALESCE((SELECT SUM(${productVariants.stock}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)}), 0) ELSE ${outer(products.stock)} END)`;
  if (stock === "out") conditions.push(sql`${effectiveStock} = 0`);
  if (stock === "low") conditions.push(sql`${effectiveStock} < 5`);

  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      status: products.status,
      viewCount: products.viewCount,
      createdAt: products.createdAt,
      vendorId: products.vendorId,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      categoryName: categories.name,
      image: sql<string | null>`(SELECT url FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC LIMIT 1)`,
      totalStock: effectiveStock,
      hasVariants: hasAnyVariant,
      favoriteCount: sql<number>`(SELECT COUNT(*) FROM ${productFavorites} WHERE ${productFavorites.productId} = ${outer(products.id)})`,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt))
    .limit(200);
}

export async function updateProductStatus(id: number, status: "draft" | "pending" | "active" | "inactive" | "rejected") {
  const [row] = await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id });
  return row ?? null;
}

export class ProductHasOrdersError extends Error {}

// Bir ürün en az bir kez sipariş edildiyse kalıcı silinemez - order_items
// referans bütünlüğünü (ve muhasebe/sipariş geçmişini) bozardı. Bu durumda
// admin ürünü "Pasife Al" ile gizlemeli (bkz. updateProductStatus). Siparişi
// hiç olmamış bir ürünün TÜM bağımlı satırları (görsel, varyant,
// değerlendirme, soru, favori, kanal eşlemesi vb.) referans bütünlüğü
// bozulmadan tek transaction'da temizlenip asıl satır silinir.
export async function deleteProduct(id: number) {
  const [orderRow] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, id)).limit(1);
  if (orderRow) throw new ProductHasOrdersError();

  return db.transaction(async (tx) => {
    const listingRows = await tx.select({ id: channelListings.id }).from(channelListings).where(eq(channelListings.productId, id));
    const listingIds = listingRows.map((r) => r.id);
    if (listingIds.length > 0) {
      await tx.delete(stockSyncOutbox).where(inArray(stockSyncOutbox.listingId, listingIds));
      await tx.delete(channelListings).where(eq(channelListings.productId, id));
    }
    await tx.delete(homepageCollectionProducts).where(eq(homepageCollectionProducts.productId, id));
    await tx.delete(collectionProducts).where(eq(collectionProducts.productId, id));
    await tx.delete(fitFeedback).where(eq(fitFeedback.productId, id));
    await tx.delete(discoverFeedback).where(eq(discoverFeedback.productId, id));
    await tx.delete(discoverEvents).where(eq(discoverEvents.productId, id));
    await tx.delete(productFavorites).where(eq(productFavorites.productId, id));
    await tx.delete(productQuestions).where(eq(productQuestions.productId, id));
    await tx.delete(productReviews).where(eq(productReviews.productId, id));
    await tx.delete(productVariants).where(eq(productVariants.productId, id));
    await tx.delete(productImages).where(eq(productImages.productId, id));
    const result = await tx.delete(products).where(eq(products.id, id)).returning({ id: products.id });
    return result.length > 0;
  });
}

export async function countProductsByStatus() {
  const rows = await db.select({ status: products.status, count: sql<number>`COUNT(*)` }).from(products).groupBy(products.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}
