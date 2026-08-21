import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import {
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
} from "../../db/schema/index";

export type DeleteProductResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "blocked_by_orders" }
  | { status: "deleted"; mediaUrls: string[] };

/**
 * Ürünü ve silinebilir tüm alt kayıtlarını tek transaction'da kaldırır.
 * Sipariş geçmişi olan ürün finansal iz nedeniyle hiçbir zaman kalıcı silinmez.
 * Satır kilidi, sahiplik/sipariş kontrolü ile DELETE arasındaki yarışı kapatır.
 */
export async function deleteProductSafely(productId: number, expectedVendorId?: number): Promise<DeleteProductResult> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ id: products.id, vendorId: products.vendorId, videoUrl: products.videoUrl })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
      .for("update");
    if (!product) return { status: "not_found" };
    if (expectedVendorId !== undefined && product.vendorId !== expectedVendorId) return { status: "forbidden" };

    const [orderRow] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.productId, productId)).limit(1);
    if (orderRow) return { status: "blocked_by_orders" };

    const imageRows = await tx.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, productId));
    const listingRows = await tx.select({ id: channelListings.id }).from(channelListings).where(eq(channelListings.productId, productId));
    const listingIds = listingRows.map((row) => row.id);
    if (listingIds.length > 0) {
      await tx.delete(stockSyncOutbox).where(inArray(stockSyncOutbox.listingId, listingIds));
      await tx.delete(channelListings).where(eq(channelListings.productId, productId));
    }

    await tx.delete(homepageCollectionProducts).where(eq(homepageCollectionProducts.productId, productId));
    await tx.delete(collectionProducts).where(eq(collectionProducts.productId, productId));
    await tx.delete(fitFeedback).where(eq(fitFeedback.productId, productId));
    await tx.delete(discoverFeedback).where(eq(discoverFeedback.productId, productId));
    await tx.delete(discoverEvents).where(eq(discoverEvents.productId, productId));
    await tx.delete(productFavorites).where(eq(productFavorites.productId, productId));
    await tx.delete(productQuestions).where(eq(productQuestions.productId, productId));
    await tx.delete(productReviews).where(eq(productReviews.productId, productId));
    await tx.delete(productVariants).where(eq(productVariants.productId, productId));
    await tx.delete(productImages).where(eq(productImages.productId, productId));

    const where = expectedVendorId === undefined
      ? eq(products.id, productId)
      : and(eq(products.id, productId), eq(products.vendorId, expectedVendorId));
    const deleted = await tx.delete(products).where(where).returning({ id: products.id });
    if (deleted.length !== 1) throw new Error("Ürün silme işlemi yarış nedeniyle tamamlanamadı");

    return {
      status: "deleted",
      mediaUrls: [...imageRows.map((row) => row.url), ...(product.videoUrl ? [product.videoUrl] : [])],
    };
  });
}
