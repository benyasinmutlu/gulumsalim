import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders, vendorEarnings, vendors } from "../../db/schema/index";

export class RefundNotFoundError extends Error {}
export class InvalidRefundStateError extends Error {}
export class MissingPaymentInfoError extends Error {}

export async function listRefunds(status?: "pending" | "approved" | "rejected" | "item_received" | "refunded") {
  const base = db
    .select({
      id: orderRefunds.id,
      reason: orderRefunds.reason,
      photos: orderRefunds.photos,
      status: orderRefunds.status,
      vendorNote: orderRefunds.vendorNote,
      adminNote: orderRefunds.adminNote,
      returnTrackingCarrier: orderRefunds.returnTrackingCarrier,
      returnTrackingNumber: orderRefunds.returnTrackingNumber,
      returnShippedAt: orderRefunds.returnShippedAt,
      receivedByVendorAt: orderRefunds.receivedByVendorAt,
      refundedAt: orderRefunds.refundedAt,
      requestedAt: orderRefunds.requestedAt,
      vendorStoreName: vendors.storeName,
      customerName: customers.fullName,
      orderNumber: orders.orderNumber,
      productNameSnapshot: orderItems.productNameSnapshot,
      total: orderItems.total,
    })
    .from(orderRefunds)
    .innerJoin(vendors, eq(orderRefunds.vendorId, vendors.id))
    .innerJoin(customers, eq(orderRefunds.customerId, customers.id))
    .innerJoin(orderItems, eq(orderRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .orderBy(desc(orderRefunds.requestedAt));

  if (status) return base.where(eq(orderRefunds.status, status));
  return base;
}

export async function countRefundsByStatus() {
  const rows = await db.select({ status: orderRefunds.status, count: sql<number>`COUNT(*)` }).from(orderRefunds).groupBy(orderRefunds.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

// releaseRefund'ın (bkz. admin-refunds.service.ts) iyzico çağrısından ÖNCE
// ihtiyaç duyduğu bilgiler - dış API isteği bir DB transaction'ının İÇİNDE
// yapılmamalı (bağlantıyı ağ round-trip'i boyunca kilitli tutar, bkz.
// checkout.service.ts startCheckout'taki aynı prensip). Bu yüzden okuma ve
// nihai yazma (commitRefundRelease) iki ayrı adım.
export async function getRefundForRelease(refundId: number) {
  const [refund] = await db
    .select({
      id: orderRefunds.id,
      status: orderRefunds.status,
      orderItemId: orderRefunds.orderItemId,
      vendorId: orderRefunds.vendorId,
    })
    .from(orderRefunds)
    .where(eq(orderRefunds.id, refundId))
    .limit(1);
  if (!refund) throw new RefundNotFoundError();
  if (refund.status !== "item_received") throw new InvalidRefundStateError();

  const [item] = await db
    .select({ orderId: orderItems.orderId, total: orderItems.total })
    .from(orderItems)
    .where(eq(orderItems.id, refund.orderItemId))
    .limit(1);
  if (!item) throw new Error("Sipariş kalemi bulunamadı");

  const [order] = await db
    .select({ paymentTransactionId: orders.paymentTransactionId })
    .from(orders)
    .where(eq(orders.id, item.orderId))
    .limit(1);
  if (!order?.paymentTransactionId) throw new MissingPaymentInfoError();

  const [earning] = await db
    .select({ netAmount: vendorEarnings.netAmount })
    .from(vendorEarnings)
    .where(eq(vendorEarnings.orderItemId, refund.orderItemId))
    .limit(1);

  return {
    refundId: refund.id,
    orderItemId: refund.orderItemId,
    vendorId: refund.vendorId,
    itemTotal: item.total,
    paymentTransactionId: order.paymentTransactionId,
    vendorNetEarning: earning?.netAmount ?? null,
  };
}

// bkz. kullanıcı isteği: "ürün satıcıya teslim edildiğinden emin
// olduğumuzda müşteriye parasını iade edeceğiz" - iyzico çağrısı zaten
// BAŞARILI olduktan sonra (bkz. admin-refunds.service.ts releaseRefund)
// çağrılır: iade kaydı + sipariş kalemi durumu + satıcı cüzdanından
// düşülen kazanç tek transaction'da, ya hep ya hiç. Satıcının cüzdanından
// düşülen tutar GREATEST(0, ...) ile taban sınırlanır - kazancını zaten
// harcamış/çekmiş bir satıcının bakiyesi negatife düşmesin diye (bunun
// muhasebe kaydı zaten vendor_earnings/order_refunds tablolarında kalıcı).
export async function commitRefundRelease(refundId: number, orderItemId: number, vendorId: number, netEarningToDeduct: string | null) {
  return db.transaction(async (tx) => {
    const [refund] = await tx
      .update(orderRefunds)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(eq(orderRefunds.id, refundId))
      .returning();
    if (!refund) throw new Error("İade kaydı güncellenemedi");

    await tx.update(orderItems).set({ vendorStatus: "refunded" }).where(eq(orderItems.id, orderItemId));

    if (netEarningToDeduct) {
      await tx
        .update(vendors)
        .set({ walletBalance: sql`GREATEST(0, ${vendors.walletBalance} - ${netEarningToDeduct})` })
        .where(eq(vendors.id, vendorId));
    }

    return refund;
  });
}
