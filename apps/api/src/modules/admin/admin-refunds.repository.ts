import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orderRefunds, orders, vendorEarnings, vendors } from "../../db/schema/index";

export class RefundNotFoundError extends Error {}
export class InvalidRefundStateError extends Error {}
export class MissingPaymentInfoError extends Error {}

export async function listRefunds(status?: "pending" | "approved" | "rejected" | "item_received" | "refunding" | "refunded") {
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
export async function claimRefundForRelease(refundId: number) {
  return db.transaction(async (tx) => {
    const [refund] = await tx
      .update(orderRefunds)
      .set({ status: "refunding" })
      .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.status, "item_received")))
      .returning({ id: orderRefunds.id, orderItemId: orderRefunds.orderItemId, vendorId: orderRefunds.vendorId });
    if (!refund) {
      const [existing] = await tx.select({ id: orderRefunds.id }).from(orderRefunds).where(eq(orderRefunds.id, refundId)).limit(1);
      if (!existing) throw new RefundNotFoundError();
      throw new InvalidRefundStateError();
    }

    const [item] = await tx
      .select({ orderId: orderItems.orderId, total: orderItems.total, paymentTransactionId: orderItems.paymentTransactionId })
      .from(orderItems)
      .where(eq(orderItems.id, refund.orderItemId))
      .limit(1);
    if (!item) throw new Error("Sipariş kalemi bulunamadı");

    const [order] = await tx
      .select({ paymentId: orders.paymentTransactionId })
      .from(orders)
      .where(eq(orders.id, item.orderId))
      .limit(1);
    const [orderItemCount] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(orderItems)
      .where(eq(orderItems.orderId, item.orderId));

    // Yeni siparislerde guvenli kalem-bazli Refund kullanilir. Eski kayitlarda
    // kalem transaction id yoksa Refund V2 yalniz tek kalemli sipariste
    // kullanilabilir; cok kalemde hangi urunun iade edilecegi belirsizdir.
    const refundTarget = item.paymentTransactionId
      ? { mode: "item" as const, id: item.paymentTransactionId }
      : (order?.paymentId && orderItemCount?.count === 1
          ? { mode: "payment" as const, id: order.paymentId }
          : null);
    if (!refundTarget) throw new MissingPaymentInfoError();

    const [earning] = await tx
      .select({ netAmount: vendorEarnings.netAmount })
      .from(vendorEarnings)
      .where(eq(vendorEarnings.orderItemId, refund.orderItemId))
      .limit(1);

    return {
      refundId: refund.id,
      orderItemId: refund.orderItemId,
      vendorId: refund.vendorId,
      itemTotal: item.total,
      refundTarget,
      vendorNetEarning: earning?.netAmount ?? null,
    };
  });
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
      .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.status, "refunding")))
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

export async function resetRefundReleaseClaim(refundId: number): Promise<boolean> {
  const rows = await db
    .update(orderRefunds)
    .set({ status: "item_received" })
    .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.status, "refunding")))
    .returning({ id: orderRefunds.id });
  return rows.length === 1;
}

// Ag hatasi/imza uyusmazligi sonrasi 'refunding' kalan kaydi admin iyzico
// panelinden dogruladiktan sonra yerel muhasebeye guvenle yansitir. Provider'a
// ikinci bir para iadesi istegi GONDERMEZ.
export async function confirmRefundReleaseAfterProviderCheck(refundId: number) {
  return db.transaction(async (tx) => {
    const [refund] = await tx
      .select({ orderItemId: orderRefunds.orderItemId, vendorId: orderRefunds.vendorId })
      .from(orderRefunds)
      .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.status, "refunding")))
      .limit(1);
    if (!refund) throw new InvalidRefundStateError();
    const [earning] = await tx
      .select({ netAmount: vendorEarnings.netAmount })
      .from(vendorEarnings)
      .where(eq(vendorEarnings.orderItemId, refund.orderItemId))
      .limit(1);
    const [updated] = await tx
      .update(orderRefunds)
      .set({ status: "refunded", refundedAt: new Date() })
      .where(and(eq(orderRefunds.id, refundId), eq(orderRefunds.status, "refunding")))
      .returning();
    if (!updated) throw new InvalidRefundStateError();
    await tx.update(orderItems).set({ vendorStatus: "refunded" }).where(eq(orderItems.id, refund.orderItemId));
    if (earning?.netAmount) {
      await tx
        .update(vendors)
        .set({ walletBalance: sql`GREATEST(0, ${vendors.walletBalance} - ${earning.netAmount})` })
        .where(eq(vendors.id, refund.vendorId));
    }
    return updated;
  });
}
