import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orderRefunds, orders, vendorEarnings, vendorPayouts, vendors } from "../../db/schema/index";

export async function getVendorWalletSummary(vendorId: number) {
  const [vendor] = await db
    .select({ walletBalance: vendors.walletBalance, commissionRate: vendors.commissionRate })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const [earningsSum] = await db
    .select({
      totalGross: sql<string>`COALESCE(SUM(${vendorEarnings.grossAmount}), 0)`,
      totalNet: sql<string>`COALESCE(SUM(${vendorEarnings.netAmount}), 0)`,
    })
    .from(vendorEarnings)
    .where(eq(vendorEarnings.vendorId, vendorId));

  const [paidOutSum] = await db
    .select({ totalPaid: sql<string>`COALESCE(SUM(${vendorPayouts.amount}), 0)` })
    .from(vendorPayouts)
    .where(and(eq(vendorPayouts.vendorId, vendorId), eq(vendorPayouts.status, "paid")));

  // vendor_earnings kaydı sadece kalem "delivered" olduğunda oluşur (bkz.
  // vendor-orders.service.ts) - henüz teslim edilmemiş ödenmiş kalemlerin
  // net tutarı burada "bekleyen kazanç" olarak projekte edilir.
  const rate = vendor?.commissionRate ? Number(vendor.commissionRate) : 10;
  const [pendingRow] = await db
    .select({ totalGross: sql<string>`COALESCE(SUM(${orderItems.total}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.vendorId, vendorId),
        eq(orders.paymentStatus, "paid"),
        inArray(orderItems.vendorStatus, ["pending", "processing", "shipped"]),
      ),
    );
  const pendingGross = Number(pendingRow?.totalGross ?? 0);
  const pendingNet = (pendingGross * (1 - rate / 100)).toFixed(2);

  return {
    walletBalance: vendor?.walletBalance ?? "0.00",
    totalGross: earningsSum?.totalGross ?? "0.00",
    totalNet: earningsSum?.totalNet ?? "0.00",
    totalPaidOut: paidOutSum?.totalPaid ?? "0.00",
    pendingEarnings: pendingNet,
    // bkz. kullanıcı isteği: "satıcıda ne kadar komisyon alınacak ... önemli" -
    // satıcı panelinde kendi oranını görebilmeli. vendor.commissionRate NULL
    // ise platform varsayılanı (aynı `rate` değişkeni, yukarıda hesaplandı).
    commissionRate: rate,
  };
}

export async function listVendorEarnings(vendorId: number) {
  return db
    .select({
      id: vendorEarnings.id,
      orderItemId: vendorEarnings.orderItemId,
      orderNumber: orders.orderNumber,
      productName: orderItems.productNameSnapshot,
      netAmount: vendorEarnings.netAmount,
      createdAt: vendorEarnings.createdAt,
    })
    .from(vendorEarnings)
    .innerJoin(orderItems, eq(vendorEarnings.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(vendorEarnings.vendorId, vendorId))
    .orderBy(desc(vendorEarnings.createdAt));
}

export async function listVendorPayouts(vendorId: number) {
  return db.select().from(vendorPayouts).where(eq(vendorPayouts.vendorId, vendorId)).orderBy(desc(vendorPayouts.requestedAt));
}

export async function listVendorRefundsWithOrder(vendorId: number) {
  return db
    .select({
      id: orderRefunds.id,
      orderNumber: orders.orderNumber,
      reason: orderRefunds.reason,
      status: orderRefunds.status,
      amount: orderItems.total,
      requestedAt: orderRefunds.requestedAt,
    })
    .from(orderRefunds)
    .innerJoin(orderItems, eq(orderRefunds.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderRefunds.vendorId, vendorId))
    .orderBy(desc(orderRefunds.requestedAt))
    .limit(10);
}
