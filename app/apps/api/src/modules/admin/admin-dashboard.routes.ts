import { FastifyPluginAsync } from "fastify";
import {
  getAdminUnreadCounts,
  getDashboardStats,
  listLowStockProducts,
  listMostViewedProducts,
  listRecentOrders,
} from "./admin-dashboard.repository";

const adminDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/dashboard", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const [stats, recentOrders, lowStockProducts, mostViewedProducts] = await Promise.all([
      getDashboardStats(),
      listRecentOrders(8),
      listLowStockProducts(5),
      listMostViewedProducts(8),
    ]);
    return reply.send({ stats, recentOrders, lowStockProducts, mostViewedProducts });
  });

  app.get("/admin/unread-summary", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await getAdminUnreadCounts());
  });
};

export default adminDashboardRoutes;
