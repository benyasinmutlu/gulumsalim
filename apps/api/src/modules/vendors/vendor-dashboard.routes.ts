import { FastifyPluginAsync } from "fastify";
import { getVendorDashboardStats, listRecentVendorOrders } from "./vendor-dashboard.repository";

const vendorDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/dashboard", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const [stats, recentOrders] = await Promise.all([
      getVendorDashboardStats(vendorId),
      listRecentVendorOrders(vendorId, 5),
    ]);
    return reply.send({ stats, recentOrders });
  });
};

export default vendorDashboardRoutes;
