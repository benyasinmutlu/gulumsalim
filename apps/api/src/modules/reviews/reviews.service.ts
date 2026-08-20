import { findReviewableOrderItem, insertReview } from "./reviews.repository";

export class NotPurchasedError extends Error {}
export class AlreadyReviewedError extends Error {}

export async function submitReview(
  customerId: number,
  productId: number,
  data: { rating: number; comment?: string },
) {
  const orderItem = await findReviewableOrderItem(customerId, productId);
  if (!orderItem) throw new NotPurchasedError();

  try {
    return await insertReview({
      productId,
      customerId,
      orderItemId: orderItem.id,
      rating: data.rating,
      comment: data.comment,
    });
  } catch (err) {
    // Çift tıklama gibi bir yarış durumunda unique index bunu yakalar
    // (bkz. db/schema/catalog.ts uniq_reviews_order_item).
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      throw new AlreadyReviewedError();
    }
    throw err;
  }
}
