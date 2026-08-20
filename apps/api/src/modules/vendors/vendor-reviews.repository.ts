import { and, avg, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orders, vendorReviews, vendors } from "../../db/schema/index";

// vendor-store.php'deki mağaza değerlendirmesi formunun karşılığı - ürün
// değerlendirmesindeki "doğrulanmış satın alma" kuralının mağaza
// seviyesindeki eşdeğeri: bu satıcıdan en az bir teslim edilmiş siparişi
// olmalı ve bu mağazayı daha önce değerlendirmemiş olmalı.
export async function findReviewableVendor(customerId: number, vendorId: number) {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(vendorReviews, and(eq(vendorReviews.vendorId, vendorId), eq(vendorReviews.customerId, customerId)))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orderItems.vendorId, vendorId),
        eq(orderItems.vendorStatus, "delivered"),
        isNull(vendorReviews.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertVendorReview(data: { vendorId: number; customerId: number; rating: number; comment?: string }) {
  const [row] = await db.insert(vendorReviews).values(data).returning();
  if (!row) throw new Error("Değerlendirme kaydedilemedi");
  return row;
}

export async function listApprovedVendorReviews(vendorId: number) {
  return db
    .select({
      id: vendorReviews.id,
      rating: vendorReviews.rating,
      comment: vendorReviews.comment,
      createdAt: vendorReviews.createdAt,
      customerName: customers.fullName,
    })
    .from(vendorReviews)
    .innerJoin(customers, eq(vendorReviews.customerId, customers.id))
    .where(and(eq(vendorReviews.vendorId, vendorId), eq(vendorReviews.status, "approved")))
    .orderBy(desc(vendorReviews.createdAt));
}

export async function getVendorReviewSummary(vendorId: number) {
  const [row] = await db
    .select({ average: avg(vendorReviews.rating), total: count(vendorReviews.id) })
    .from(vendorReviews)
    .where(and(eq(vendorReviews.vendorId, vendorId), eq(vendorReviews.status, "approved")));
  return { average: row?.average ? Number(row.average) : null, total: row?.total ?? 0 };
}

export async function listPendingVendorReviews() {
  return db
    .select({
      id: vendorReviews.id,
      vendorId: vendorReviews.vendorId,
      rating: vendorReviews.rating,
      comment: vendorReviews.comment,
      createdAt: vendorReviews.createdAt,
      customerName: customers.fullName,
      vendorStoreName: vendors.storeName,
    })
    .from(vendorReviews)
    .innerJoin(customers, eq(vendorReviews.customerId, customers.id))
    .innerJoin(vendors, eq(vendorReviews.vendorId, vendors.id))
    .where(eq(vendorReviews.status, "pending"))
    .orderBy(desc(vendorReviews.createdAt));
}

export async function updateVendorReviewStatus(reviewId: number, status: "approved" | "rejected") {
  const [row] = await db
    .update(vendorReviews)
    .set({ status })
    .where(eq(vendorReviews.id, reviewId))
    .returning({ id: vendorReviews.id });
  return row ?? null;
}
