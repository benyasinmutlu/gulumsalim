import { and, avg, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, orderItems, orders, productReviews, products, productVariants, vendorFollowers, vendors } from "../../db/schema/index";

const LOW_STOCK_THRESHOLD = 5;
// bkz. kullanıcı isteği (mockup): satıcı panelinde "satış grafiği" - son 30
// gün, vendor-promo-banners.repository.ts'teki STATS_WINDOW_DAYS/sıfır
// doldurma deseniyle birebir aynı yaklaşım.
const SALES_CHART_DAYS = 30;

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
    [plainStockLowRow],
    [followerRow],
    [storeViewRow],
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
    // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
    // zorunlu olarak girilmeli" - varyantsız (renk/beden eklenmemiş) ürünler
    // artık products.stock üzerinden gerçek stok taşıyor, yukarıdaki
    // sorgu (product_variants join'i) bunları hiç göremiyor - burada ayrıca
    // sayılır.
    db
      .select({ count: count() })
      .from(products)
      .where(and(
        eq(products.vendorId, vendorId),
        eq(products.status, "active"),
        sql`NOT EXISTS (SELECT 1 FROM ${productVariants} WHERE ${productVariants.productId} = ${products.id})`,
        sql`${products.stock} < ${LOW_STOCK_THRESHOLD}`,
      )),
    db.select({ count: count() }).from(vendorFollowers).where(eq(vendorFollowers.vendorId, vendorId)),
    db.select({ storeViewCount: vendors.storeViewCount }).from(vendors).where(eq(vendors.id, vendorId)).limit(1),
  ]);

  return {
    todaySales: todaySalesRow?.total ?? "0",
    monthSales: monthSalesRow?.total ?? "0",
    totalOrders: orderCountRow?.count ?? 0,
    pendingOrders: pendingRow?.count ?? 0,
    productCount: productCountRow?.count ?? 0,
    avgRating: reviewRow?.average ? Number(reviewRow.average) : null,
    reviewCount: reviewRow?.total ?? 0,
    lowStockCount: lowStockRows.length + (plainStockLowRow?.count ?? 0),
    followerCount: followerRow?.count ?? 0,
    storeViewCount: storeViewRow?.storeViewCount ?? 0,
  };
}

// bkz. kullanıcı isteği (mockup): satıcı panelinde satış grafiği (çizgi) -
// vendor-reports.routes.ts'teki aylık ciro sorgusunun günlük hali, sıfır
// doldurma vendor-promo-banners.repository.ts'teki getVendorBannerStats
// deseniyle aynı (grafikte boşluk/atlama olmasın diye).
export async function getVendorSalesTimeSeries(vendorId: number) {
  const since = new Date();
  since.setDate(since.getDate() - (SALES_CHART_DAYS - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM-DD')`,
      total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, since)))
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
// orderItems.vendorStatus'a göre kırılım (orders.status DEĞİL - bkz. şema
// yorumu, ikisi kasıtlı olarak ayrı: vendorStatus bu satıcının kendi
// yerine getirme durumu).
export async function getVendorOrderStatusBreakdown(vendorId: number) {
  const rows = await db
    .select({ status: orderItems.vendorStatus, count: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid")))
    .groupBy(orderItems.vendorStatus);
  return rows;
}

// bkz. kullanıcı isteği (mockup): istatistik kartlarının yanında "+12,6%"
// gibi bir önceki döneme göre değişim yüzdesi - takvim ayı sınırları
// (bu ay kısmi, geçen ay tam) karşılaştırmayı çarpıtacağı için, bunun
// yerine ADİL bir kıyas olan "son 30 gün" / "ondan önceki 30 gün" kayan
// pencere kullanılır. Ziyaretçi sayısı (vendors.storeViewCount) İÇİN bu
// hesap YAPILAMAZ - o alan tek bir toplam sayaç, günlük geçmişi tutulmuyor
// (bkz. Faz 20 yorumu), bu yüzden burada kasıtlı olarak yok - uydurma bir
// yüzde göstermektense hiç gösterilmemesi tercih edildi.
function computeChangePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getVendorPeriodComparison(vendorId: number) {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 30);
  const previousPeriodStart = new Date(now);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - 60);

  const [[current], [previous]] = await Promise.all([
    db
      .select({
        revenue: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), eq(orders.paymentStatus, "paid"), gte(orders.createdAt, periodStart))),
    db
      .select({
        revenue: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.vendorId, vendorId),
          eq(orders.paymentStatus, "paid"),
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
