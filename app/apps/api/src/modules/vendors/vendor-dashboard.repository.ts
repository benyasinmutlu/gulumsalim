import { and, avg, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orders, productReviews, products, productVariants, vendorFollowers } from "../../db/schema/index";

const LOW_STOCK_THRESHOLD = 5;

// vendor/index.php'nin karşılığı - önceki halde bu sayfa yanlışlıkla
// finans/cüzdan kartlarını tekrarlıyordu (bkz. re-audit bulgusu), gerçek
// dashboard içeriği (satış/sipariş/ürün/puan istatistikleri, düşük stok,
// son siparişler) hiç yoktu.
export async function getVendorDashboardStats(vendorId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    [todaySalesRow],
    [monthSalesRow],
    [orderCountRow],
    [pendingRow],
    [productCountRow],
    [reviewRow],
    lowStockRows,
    [followerRow],
  ] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, today))),
    db
      .select({ total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, monthStart))),
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${orderItems.orderId})` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid"))),
    // bkz. vendor-orders.repository.ts countPendingVendorOrders - listVendorOrderItems ile
    // AYNI paymentStatus='paid' filtresini kullanmalı, aksi halde ödenmemiş siparişler de
    // sayılıp panoda "bekleyen sipariş" olarak yanlış gösterilir.
    db
      .select({ count: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), eq(orderItems.vendorStatus, "pending"), eq(orders.paymentStatus, "paid"))),
    db.select({ count: count() }).from(products).where(and(eq(products.vendorId, vendorId), eq(products.status, "active"))),
    db
      .select({ average: avg(productReviews.rating), total: count(productReviews.id) })
      .from(productReviews)
      .innerJoin(products, eq(productReviews.productId, products.id))
      .where(and(eq(products.vendorId, vendorId), eq(productReviews.status, "approved"))),
    db
      .select({ productId: productVariants.productId, totalStock: sql<number>`SUM(${productVariants.stock})`.mapWith(Number) })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(eq(products.vendorId, vendorId), eq(products.status, "active")))
      .groupBy(productVariants.productId)
      .having(sql`COALESCE(SUM(${productVariants.stock}), 0) < ${LOW_STOCK_THRESHOLD}`),
    db.select({ count: count() }).from(vendorFollowers).where(eq(vendorFollowers.vendorId, vendorId)),
  ]);

  return {
    todaySales: todaySalesRow?.total ?? "0",
    monthSales: monthSalesRow?.total ?? "0",
    totalOrders: orderCountRow?.count ?? 0,
    pendingOrders: pendingRow?.count ?? 0,
    productCount: productCountRow?.count ?? 0,
    avgRating: reviewRow?.average ? Number(reviewRow.average) : null,
    reviewCount: reviewRow?.total ?? 0,
    lowStockCount: lowStockRows.length,
    followerCount: followerRow?.count ?? 0,
  };
}

export async function listRecentVendorOrders(vendorId: number, limit = 5) {
  return db
    .select({
      id: orderItems.id,
      orderNumber: orders.orderNumber,
      productNameSnapshot: orderItems.productNameSnapshot,
      total: orderItems.total,
      vendorStatus: orderItems.vendorStatus,
      createdAt: orders.createdAt,
      customerName: customers.fullName,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
