import { FastifyPluginAsync } from "fastify";
import {
  getVendorDashboardStats,
  getVendorOrderStatusBreakdown,
  getVendorPeriodComparison,
  getVendorSalesTimeSeries,
  listRecentVendorOrders,
} from "./vendor-dashboard.repository";

const vendorDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/dashboard", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const [stats, recentOrders, salesTimeSeries, orderStatusBreakdown, periodComparison] = await Promise.all([
      getVendorDashboardStats(vendorId),
      listRecentVendorOrders(vendorId, 5),
      getVendorSalesTimeSeries(vendorId),
      getVendorOrderStatusBreakdown(vendorId),
      getVendorPeriodComparison(vendorId),
    ]);
    return reply.send({ stats, recentOrders, salesTimeSeries, orderStatusBreakdown, periodComparison });
  });
};

export default vendorDashboardRoutes;
