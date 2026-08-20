import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orderRefunds, orders, vendors } from "../../db/schema/index";

export class OrderItemNotFoundError extends Error {}
export class ItemNotDeliveredError extends Error {}
export class DuplicateRefundRequestError extends Error {}
export class RefundNotFoundError extends Error {}
export class InvalidRefundStateError extends Error {}

// bkz. kullanıcı isteği: "iade süreçlerinde ürün iade edildiğinde satıcıya
// müşteri sebepleri yazıyor fotoğrafları vs atıyor bu da yine müşteri
// panelinden olacak" - iade talebi sadece TESLİM EDİLMİŞ bir kalem için
// açılabilir (henüz kargoda/hazırlanan bir ürün için "iade" anlamsız,
// o durumda iptal akışı kullanılır). Aynı kalem için zaten aktif
// (reddedilmemiş) bir talep varsa ikinci bir talep açılamaz.
export async function createCustomerRefundRequest(customerId: number, orderItemId: number, reason: string) {
  const [item] = await db
    .select({ orderId: orderItems.orderId, vendorId: orderItems.vendorId, vendorStatus: orderItems.vendorStatus })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.id, orderItemId), eq(orders.customerId, customerId)))
    .limit(1);
  if (!item) throw new OrderItemNotFoundError();
  if (item.vendorStatus !== "delivered") throw new ItemNotDeliveredError();

  const [existing] = await db
    .select({ id: orderRefunds.id })
    .from(orderRefunds)
    .where(and(eq(orderRefunds.orderItemId, orderItemId), ne(orderRefunds.status, "rejected")))
    .limit(1);
  if (existing) throw new DuplicateRefundRequestError();

  let row;
  try {
    [row] = await db
      .insert(orderRefunds)
      .values({ orderItemId, customerId, vendorId: item.vendorId, reason })
      .returning();
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") throw new DuplicateRefundRequestError();
    throw error;
  }
  if (!row) throw new Error("İade talebi oluşturulamadı");
  return row;
}

// Talep oluşturulduktan sonra fotoğraflar ayrı isteklerle eklenir (bkz.
// vendor-promo-banners.routes.ts'deki "ek görsel" deseniyle aynı - tek
// multipart istekte hem metin hem birden fazla dosya taşımak yerine).
// Sadece talep sahibi müşteri, talep hâlâ "pending" iken fotoğraf ekleyebilir.
export async function addRefundPhoto(customerId: number, refundId: number, photoUrl: string) {
  const [row] = await db
    .update(orderRefunds)
    .set({ photos: sql`COALESCE(${orderRefunds.photos}, '[]'::jsonb) || jsonb_build_array(${photoUrl})` })
    .where(and(
      eq(orderRefunds.id, refundId),
      eq(orderRefunds.customerId, customerId),
      eq(orderRefunds.status, "pending"),
      sql`jsonb_array_length(COALESCE(${orderRefunds.photos}, '[]'::jsonb)) < 6`,
    ))
    .returning();
  if (row) return row;
  const [existing] = await db.select({ status: orderRefunds.status }).from(orderRefunds)
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.customerId, customerId))).limit(1);
  if (!existing) throw new RefundNotFoundError();
  if (existing.status !== "pending") throw new InvalidRefundStateError();
  return null;
}

// bkz. kullanıcı isteği: "iade ederken müşteri kargolayacağı için müşteri
// takip numarasını girecek sisteme" - sadece satıcı onayladıktan (status
// "approved") sonra girilebilir, henüz karar verilmemiş/reddedilmiş bir
// talebe takip kodu eklemek anlamsız.
export async function submitReturnTracking(customerId: number, refundId: number, carrier: string, trackingNumber: string) {
  const [row] = await db
    .update(orderRefunds)
    .set({ returnTrackingCarrier: carrier, returnTrackingNumber: trackingNumber, returnShippedAt: new Date() })
    .where(and(
      eq(orderRefunds.id, refundId),
      eq(orderRefunds.customerId, customerId),
      eq(orderRefunds.status, "approved"),
    ))
    .returning();
  if (row) return row;
  const [existing] = await db.select({ status: orderRefunds.status }).from(orderRefunds)
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.customerId, customerId))).limit(1);
  if (!existing) throw new RefundNotFoundError();
  throw new InvalidRefundStateError();
}

export async function listCustomerRefunds(customerId: number) {
  return db
    .select({
      id: orderRefunds.id,
      orderItemId: orderRefunds.orderItemId,
      reason: orderRefunds.reason,
      photos: orderRefunds.photos,
      status: orderRefunds.status,
      vendorNote: orderRefunds.vendorNote,
      returnTrackingCarrier: orderRefunds.returnTrackingCarrier,
      returnTrackingNumber: orderRefunds.returnTrackingNumber,
      returnShippedAt: orderRefunds.returnShippedAt,
      receivedByVendorAt: orderRefunds.receivedByVendorAt,
      refundedAt: orderRefunds.refundedAt,
      requestedAt: orderRefunds.requestedAt,
      productNameSnapshot: orderItems.productNameSnapshot,
      orderNumber: orders.orderNumber,
      vendorStoreName: vendors.storeName,
    })
    .from(orderRefunds)
    .innerJoin(orderItems, eq(orderRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(vendors, eq(orderRefunds.vendorId, vendors.id))
    .where(eq(orderRefunds.customerId, customerId))
    .orderBy(desc(orderRefunds.requestedAt));
}
