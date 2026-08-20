import { FastifyPluginAsync } from "fastify";
import {
  aggregateTopCategories,
  getAdminOrderStatusBreakdown,
  getAdminPeriodComparison,
  getAdminSalesTimeSeries,
  getAdminUnreadCounts,
  getDashboardStats,
  getTodaySummary,
  hydrateProductStatRows,
  listLowStockProducts,
  listMostViewedProducts,
  listRecentOrders,
} from "./admin-dashboard.repository";
import { getActivePages, getOnlineCount, getVisitorsLast7Days, getVisitorsToday } from "../analytics/presence";
import { dateRangeForPeriod, getContentEventTotals } from "../analytics/content-analytics.repository";

const adminDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/dashboard", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const [stats, recentOrders, lowStockProducts, mostViewedProducts, salesTimeSeries, orderStatusBreakdown, periodComparison] =
      await Promise.all([
        getDashboardStats(),
        listRecentOrders(8),
        listLowStockProducts(5),
        listMostViewedProducts(8),
        getAdminSalesTimeSeries(),
        getAdminOrderStatusBreakdown(),
        getAdminPeriodComparison(),
      ]);
    return reply.send({ stats, recentOrders, lowStockProducts, mostViewedProducts, salesTimeSeries, orderStatusBreakdown, periodComparison });
  });

  app.get("/admin/unread-summary", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await getAdminUnreadCounts());
  });

  // bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
  // görebilmeliyim ve bunun gibi bir çok detayı analizi ... hangi üründe
  // nerde kaç saniye duruldu hangilerine en çok tıklanıldı" - client tarafı
  // (live-analytics-panel.tsx) bu ucu periyodik olarak (~10-15 sn) çeker.
  app.get("/admin/dashboard/live", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const { from, to } = dateRangeForPeriod("day");
    const [onlineNow, activePages, visitorsToday, visitorsLast7Days, topViewed, topPurchased, avgDwell, todaySummary] = await Promise.all([
      getOnlineCount(app.redis),
      getActivePages(app.redis),
      getVisitorsToday(app.redis),
      getVisitorsLast7Days(app.redis),
      getContentEventTotals("product", "view", from, to, 8),
      getContentEventTotals("product", "purchase", from, to, 8),
      getContentEventTotals("product", "dwell", from, to, 8),
      getTodaySummary(),
    ]);

    const [topViewedHydrated, topPurchasedHydrated, avgDwellHydrated] = await Promise.all([
      hydrateProductStatRows(topViewed.map((v) => ({ productId: v.contentId, count: v.total }))),
      hydrateProductStatRows(topPurchased.map((p) => ({ productId: p.contentId, quantity: p.total }))),
      hydrateProductStatRows(avgDwell.map((d) => ({ productId: d.contentId, avgSeconds: Math.round(d.total / Math.max(d.count, 1) / 1000) }))),
    ]);
    const topCategoriesToday = aggregateTopCategories(topViewedHydrated);

    return reply.send({
      onlineNow,
      activePages,
      visitorsToday,
      visitorsLast7Days,
      topViewedToday: topViewedHydrated,
      topPurchasedToday: topPurchasedHydrated,
      topCategoriesToday,
      avgDwellToday: avgDwellHydrated,
      todaySummary,
    });
  });
};

export default adminDashboardRoutes;
