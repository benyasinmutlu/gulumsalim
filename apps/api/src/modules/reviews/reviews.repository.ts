import { and, avg, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { outer } from "../../lib/sql-helpers";
import { createNotification } from "../notifications/notifications.repository";
import { customers, orderItems, orders, productImages, productReviews, products, vendors } from "../../db/schema/index";

// Sadece TESLİM EDİLMİŞ ve daha önce yorumlanmamış bir sipariş kalemi
// için değerlendirme yapılabilir - gulumsalim.com'daki "doğrulanmış satın
// alma" kuralının aynısı. Aynı sipariş kalemine ikinci kez yorum
// yapılamaz (LEFT JOIN + IS NULL ile kontrol edilir).
export async function findReviewableOrderItem(customerId: number, productId: number) {
  const [row] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(productReviews, eq(productReviews.orderItemId, orderItems.id))
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orderItems.productId, productId),
        eq(orderItems.vendorStatus, "delivered"),
        isNull(productReviews.id),
      ),
    )
    .limit(1);
  return row ?? null;
}

// bkz. kullanıcı isteği: "müşterinin aldığı ürünlere yıldız ve yorum
// yapmaya itelim" - hesabım/siparişlerim sayfasında, teslim alınmış ama
// henüz yorumlanmamış sipariş kalemlerini listeleyip müşteriyi
// değerlendirmeye yönlendirmek için kullanılır.
export async function listPendingReviewItems(customerId: number) {
  return db
    .select({
      orderItemId: orderItems.id,
      orderNumber: orders.orderNumber,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      imageUrl: sql<string | null>`(SELECT ${productImages.url} FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC LIMIT 1)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productReviews, eq(productReviews.orderItemId, orderItems.id))
    .where(and(eq(orders.customerId, customerId), eq(orderItems.vendorStatus, "delivered"), isNull(productReviews.id)))
    .orderBy(desc(orders.createdAt));
}

export async function insertReview(data: {
  productId: number;
  customerId: number;
  orderItemId: number;
  rating: number;
  comment?: string;
}) {
  const [row] = await db.insert(productReviews).values(data).returning();
  if (!row) throw new Error("Değerlendirme kaydedilemedi");

  const [product] = await db.select({ vendorId: products.vendorId, name: products.name }).from(products).where(eq(products.id, data.productId)).limit(1);
  if (product) {
    await createNotification(product.vendorId, "new_review", "Yeni Ürün Değerlendirmesi", `"${product.name}" için yeni bir değerlendirme var.`, "/satici/panel/degerlendirmeler");
  }

  return row;
}

export async function listApprovedReviews(productId: number) {
  return db
    .select({
      id: productReviews.id,
      rating: productReviews.rating,
      comment: productReviews.comment,
      createdAt: productReviews.createdAt,
      customerName: customers.fullName,
      vendorReply: productReviews.vendorReply,
    })
    .from(productReviews)
    .innerJoin(customers, eq(productReviews.customerId, customers.id))
    .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")))
    .orderBy(desc(productReviews.createdAt));
}

export async function getReviewSummary(productId: number) {
  const [row] = await db
    .select({ average: avg(productReviews.rating), total: count(productReviews.id) })
    .from(productReviews)
    .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved")));
  return { average: row?.average ? Number(row.average) : null, total: row?.total ?? 0 };
}

// gulumsalim.com'daki hesabım/değerlendirmelerim sayfasının karşılığı -
// müşterinin kendi yazdığı tüm değerlendirmeler, onay durumu ne olursa olsun.
export async function listReviewsByCustomer(customerId: number) {
  return db
    .select({
      id: productReviews.id,
      rating: productReviews.rating,
      comment: productReviews.comment,
      status: productReviews.status,
      createdAt: productReviews.createdAt,
      productId: productReviews.productId,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(productReviews)
    .innerJoin(products, eq(productReviews.productId, products.id))
    .where(eq(productReviews.customerId, customerId))
    .orderBy(desc(productReviews.createdAt));
}

// reviews.php'deki Tümü/Onay Bekleyen/Yayında filtresinin ve ürün linki/satıcı
// yanıtı gösteriminin karşılığı - listPendingReviews sadece bekleyenleri
// döndürüyordu, admin panelinde tam liste + filtre yoktu.
export async function listAllReviews(status?: "pending" | "approved" | "rejected") {
  const base = db
    .select({
      id: productReviews.id,
      productId: productReviews.productId,
      rating: productReviews.rating,
      comment: productReviews.comment,
      vendorReply: productReviews.vendorReply,
      status: productReviews.status,
      createdAt: productReviews.createdAt,
      customerName: customers.fullName,
      productName: products.name,
      productSlug: products.slug,
      vendorStoreName: vendors.storeName,
    })
    .from(productReviews)
    .innerJoin(customers, eq(productReviews.customerId, customers.id))
    .innerJoin(products, eq(productReviews.productId, products.id))
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .orderBy(desc(productReviews.createdAt))
    .limit(200);

  if (status) return base.where(eq(productReviews.status, status));
  return base;
}

export async function countReviewsByStatus() {
  const rows = await db.select({ status: productReviews.status, count: sql<number>`COUNT(*)` }).from(productReviews).groupBy(productReviews.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

export async function deleteReview(reviewId: number) {
  const result = await db.delete(productReviews).where(eq(productReviews.id, reviewId)).returning({ id: productReviews.id });
  return result.length > 0;
}

export async function updateReviewStatus(reviewId: number, status: "approved" | "rejected" | "pending") {
  const [row] = await db
    .update(productReviews)
    .set({ status })
    .where(eq(productReviews.id, reviewId))
    .returning({ id: productReviews.id });
  return row ?? null;
}

// vendor/reviews.php'nin karşılığı - satıcının kendi ürünlerine gelen
// (onaylanmış) tüm değerlendirmeleri görüp yanıtlayabildiği gelen kutusu.
export async function listVendorReviews(vendorId: number) {
  return db
    .select({
      id: productReviews.id,
      productId: productReviews.productId,
      productName: products.name,
      rating: productReviews.rating,
      comment: productReviews.comment,
      status: productReviews.status,
      vendorReply: productReviews.vendorReply,
      createdAt: productReviews.createdAt,
      customerName: customers.fullName,
    })
    .from(productReviews)
    .innerJoin(products, eq(productReviews.productId, products.id))
    .innerJoin(customers, eq(productReviews.customerId, customers.id))
    .where(and(eq(products.vendorId, vendorId), eq(productReviews.status, "approved")))
    .orderBy(desc(productReviews.createdAt));
}

export async function findReviewOwnedByVendor(vendorId: number, reviewId: number) {
  const [row] = await db
    .select({ id: productReviews.id })
    .from(productReviews)
    .innerJoin(products, eq(productReviews.productId, products.id))
    .where(and(eq(productReviews.id, reviewId), eq(products.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

export async function replyToReview(reviewId: number, reply: string) {
  const [row] = await db
    .update(productReviews)
    .set({ vendorReply: reply })
    .where(eq(productReviews.id, reviewId))
    .returning({ id: productReviews.id });
  return row ?? null;
}
