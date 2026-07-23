import { and, count, desc, eq, isNull, ne, sql, sum } from "drizzle-orm";
import { db } from "../../db/client";
import {
  contactMessages,
  customers,
  orders,
  productQuestions,
  productReviews,
  products,
  productVariants,
  promoBanners,
  siteFeedback,
  vendorAdminMessages,
  vendorComplaints,
  vendorPayouts,
  vendors,
} from "../../db/schema/index";
import { attachPrimaryImages } from "../catalog/catalog.repository";

const LOW_STOCK_THRESHOLD = 5;

// gulumsalim.com'daki admin/index.php gösterge panelinin karşılığı - tek
// bir ekranda mağazanın günlük özeti. Eski site tek stok kolonu
// kullanıyordu (products.stock); yeni şemada stok varyant bazlı olduğu
// için "düşük stok" burada bir ürünün TÜM varyantlarının toplam stoku
// olarak hesaplanıyor.
export async function getDashboardStats() {
  const [[revenueRow], [orderCountRow], [productCountRow], [customerCountRow], [pendingRow], lowStockRows] =
    await Promise.all([
      db.select({ total: sql<string>`COALESCE(SUM(${orders.total}), 0)` }).from(orders).where(ne(orders.status, "cancelled")),
      db.select({ count: count() }).from(orders),
      db.select({ count: count() }).from(products).where(eq(products.status, "active")),
      db.select({ count: count() }).from(customers),
      db.select({ count: count() }).from(orders).where(eq(orders.status, "pending")),
      db
        .select({ productId: productVariants.productId, totalStock: sum(productVariants.stock) })
        .from(productVariants)
        .groupBy(productVariants.productId)
        .having(sql`COALESCE(SUM(${productVariants.stock}), 0) < ${LOW_STOCK_THRESHOLD}`),
    ]);

  return {
    totalRevenue: revenueRow?.total ?? "0",
    totalOrders: orderCountRow?.count ?? 0,
    totalActiveProducts: productCountRow?.count ?? 0,
    totalCustomers: customerCountRow?.count ?? 0,
    pendingOrders: pendingRow?.count ?? 0,
    lowStockCount: lowStockRows.length,
  };
}

export async function listRecentOrders(limit = 8) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
      customerName: customers.fullName,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function listLowStockProducts(limit = 5) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      basePrice: products.basePrice,
      totalStock: sql<number>`COALESCE(SUM(${productVariants.stock}), 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(eq(products.status, "active"))
    .groupBy(products.id)
    .having(sql`COALESCE(SUM(${productVariants.stock}), 0) < ${LOW_STOCK_THRESHOLD}`)
    .orderBy(sql`COALESCE(SUM(${productVariants.stock}), 0)`)
    .limit(limit);
  return attachPrimaryImages(rows);
}

// Sidebar bildirim rozetlerinin karşılığı - eski sitede admin/includes/
// sidebar.php her linkin yanında bu sayıları anlık gösteriyordu, yeni
// panelde tamamen kaybolmuştu (bkz. re-audit bulgusu).
export async function getAdminUnreadCounts() {
  const [
    [pendingOrders],
    [pendingVendors],
    [unreadVendorMessages],
    [unreadContactMessages],
    [pendingPayouts],
    [pendingReviews],
    [pendingQuestions],
    [pendingBanners],
    [pendingComplaints],
    [unreadSiteFeedback],
  ] = await Promise.all([
    db.select({ count: count() }).from(orders).where(eq(orders.status, "pending")),
    db.select({ count: count() }).from(vendors).where(eq(vendors.status, "pending")),
    db.select({ count: count() }).from(vendorAdminMessages).where(and(eq(vendorAdminMessages.sender, "vendor"), eq(vendorAdminMessages.isRead, false))),
    db.select({ count: count() }).from(contactMessages).where(eq(contactMessages.isRead, false)),
    db.select({ count: count() }).from(vendorPayouts).where(eq(vendorPayouts.status, "pending")),
    db.select({ count: count() }).from(productReviews).where(eq(productReviews.status, "pending")),
    db.select({ count: count() }).from(productQuestions).where(isNull(productQuestions.answer)),
    // bkz. kullanıcı isteği: "onay gelen bannerlar ... bildirim olarak
    // gelsin ve sol menüde de göstersin sayı ile" - satıcının gönderdiği,
    // henüz onaylanmamış bannerlar (bkz. admin-promo-banners.routes.ts
    // approve/reject).
    db.select({ count: count() }).from(promoBanners).where(eq(promoBanners.status, "pending")),
    db.select({ count: count() }).from(vendorComplaints).where(eq(vendorComplaints.status, "pending")),
    db.select({ count: count() }).from(siteFeedback).where(eq(siteFeedback.isRead, false)),
  ]);

  return {
    pendingOrders: pendingOrders?.count ?? 0,
    pendingVendors: pendingVendors?.count ?? 0,
    unreadVendorMessages: unreadVendorMessages?.count ?? 0,
    unreadContactMessages: unreadContactMessages?.count ?? 0,
    pendingPayouts: pendingPayouts?.count ?? 0,
    pendingReviews: (pendingReviews?.count ?? 0) + (pendingQuestions?.count ?? 0) + (pendingComplaints?.count ?? 0),
    pendingBanners: pendingBanners?.count ?? 0,
    pendingComplaints: pendingComplaints?.count ?? 0,
    unreadSiteFeedback: unreadSiteFeedback?.count ?? 0,
  };
}

export async function listMostViewedProducts(limit = 8) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      basePrice: products.basePrice,
      viewCount: products.viewCount,
      vendorStoreName: vendors.storeName,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.status, "active"), sql`${products.viewCount} > 0`))
    .orderBy(desc(products.viewCount))
    .limit(limit);
  return attachPrimaryImages(rows);
}
