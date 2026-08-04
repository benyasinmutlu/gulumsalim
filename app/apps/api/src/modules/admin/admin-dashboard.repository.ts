import { and, count, desc, eq, gte, inArray, isNull, ne, sql, sum } from "drizzle-orm";
import { db } from "../../db/client";
import {
  categories,
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
// bkz. kullanıcı isteği (mockup): admin panelinde site geneli satış grafiği -
// vendor-dashboard.repository.ts'teki SALES_CHART_DAYS ile aynı pencere.
const SALES_CHART_DAYS = 30;

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

// bkz. kullanıcı isteği (mockup): admin panelinde satış grafiği (çizgi) -
// vendor-dashboard.repository.ts getVendorSalesTimeSeries ile aynı desen,
// tek fark satıcı filtresi olmadan site geneli (orders.total, orders.status).
export async function getAdminSalesTimeSeries() {
  const since = new Date();
  since.setDate(since.getDate() - (SALES_CHART_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .where(and(ne(orders.status, "cancelled"), gte(orders.createdAt, since)))
    .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM-DD')`);

  const map = new Map(rows.map((r) => [r.day, r.total]));
  const series: { date: string; total: string }[] = [];
  for (let i = SALES_CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, total: map.get(key) ?? "0" });
  }
  return series;
}

// bkz. kullanıcı isteği (mockup): "sipariş durumu dağılımı (pasta grafik)" -
// site geneli, orders.status'a göre kırılım (satıcı bazlı vendorStatus
// DEĞİL - bkz. vendor-dashboard.repository.ts getVendorOrderStatusBreakdown
// yorumu, ikisi kasıtlı olarak ayrı kavramlar).
export async function getAdminOrderStatusBreakdown() {
  return db.select({ status: orders.status, count: count() }).from(orders).groupBy(orders.status);
}

// bkz. kullanıcı isteği (mockup): istatistik kartlarında "+12,6%" gibi bir
// önceki döneme göre değişim yüzdesi - vendor-dashboard.repository.ts
// getVendorPeriodComparison ile aynı desen (adil kıyas için takvim ayı
// yerine kayan "son 30 gün / önceki 30 gün" penceresi), site geneli.
function computeChangePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getAdminPeriodComparison() {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);
  const previousPeriodStart = new Date(now);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 60);

  const [[current], [previous]] = await Promise.all([
    db
      .select({ revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)`, orders: count() })
      .from(orders)
      .where(and(ne(orders.status, "cancelled"), gte(orders.createdAt, periodStart))),
    db
      .select({ revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)`, orders: count() })
      .from(orders)
      .where(
        and(
          ne(orders.status, "cancelled"),
          gte(orders.createdAt, previousPeriodStart),
          sql`${orders.createdAt} < ${periodStart}`,
        ),
      ),
  ]);

  return {
    revenueChangePercent: computeChangePercent(Number(current?.revenue ?? 0), Number(previous?.revenue ?? 0)),
    orderCountChangePercent: computeChangePercent(current?.orders ?? 0, previous?.orders ?? 0),
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

// bkz. kullanıcı isteği (2026-08-02): "admin panelden anlık sitede kaç kişi
// var görebilmeliyim ve bunun gibi bir çok detayı analizi ... bugünkü özet"
// - gösterge panelindeki 30 günlük istatistiklerin yanına, sadece bugüne
// özel anlık kartlar. getAdminSalesTimeSeries ile aynı "gün başlangıcı" desenini
// kullanır.
export async function getTodaySummary() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [[orderRow], [customerRow]] = await Promise.all([
    db
      .select({ orders: count(), revenue: sql<string>`COALESCE(SUM(${orders.total}), 0)` })
      .from(orders)
      .where(and(ne(orders.status, "cancelled"), gte(orders.createdAt, todayStart))),
    db.select({ count: count() }).from(customers).where(gte(customers.createdAt, todayStart)),
  ]);

  return {
    orders: orderRow?.orders ?? 0,
    revenue: orderRow?.revenue ?? "0",
    newCustomers: customerRow?.count ?? 0,
  };
}

// Redis'ten gelen {productId, ...} sıralı listelerini (bkz. analytics/presence.ts
// getTopViewedToday/getTopPurchasedToday/getAvgDwellToday) ürün adı/görsel/
// kategoriyle zenginleştirir - tek bir yardımcı, üç ayrı "bugün en çok..."
// tablosu tarafından da, kategori kırılımı hesabı tarafından da kullanılır.
export async function hydrateProductStatRows<T extends { productId: number }>(
  rows: T[],
): Promise<(T & { productName: string; primaryImageUrl: string | null; categoryName: string; categorySlug: string })[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.productId);
  const productRows = await db
    .select({ id: products.id, name: products.name, categoryName: categories.name, categorySlug: categories.slug })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(products.id, ids));
  const withImages = await attachPrimaryImages(productRows);
  const byId = new Map(withImages.map((p) => [p.id, p]));
  return rows.flatMap((row) => {
    const product = byId.get(row.productId);
    if (!product) return [];
    return [{ ...row, productName: product.name, primaryImageUrl: product.primaryImageUrl, categoryName: product.categoryName, categorySlug: product.categorySlug }];
  });
}

// bkz. kullanıcı isteği: "en çok görüntülenen/satın alınan ... kategoriler"
// - bugün en çok görüntülenen ürünlerin kategorilerine göre görüntülenme
// toplamı (Redis'te ayrı bir kategori sayacı tutulmuyor, ürün bazlı
// sayaçlardan burada toplanıyor - kategori sayısı azdır, maliyeti düşük).
export function aggregateTopCategories(
  hydratedViews: { categoryName: string; categorySlug: string; count: number }[],
  limit = 6,
): { categoryName: string; categorySlug: string; totalViews: number }[] {
  const byCategory = new Map<string, { categoryName: string; categorySlug: string; totalViews: number }>();
  for (const row of hydratedViews) {
    const existing = byCategory.get(row.categorySlug);
    if (existing) {
      existing.totalViews += row.count;
    } else {
      byCategory.set(row.categorySlug, { categoryName: row.categoryName, categorySlug: row.categorySlug, totalViews: row.count });
    }
  }
  return [...byCategory.values()].sort((a, b) => b.totalViews - a.totalViews).slice(0, limit);
}
