import { FastifyPluginAsync } from "fastify";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, products } from "../../db/schema/index";

const vendorReportsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/reports", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const excludedStatuses: ("cancelled" | "refunded")[] = ["cancelled", "refunded"];

    // Son 14 gün, günlük ciro (grafik/tablo için)
    const dailySales = await db
      .select({
        day: sql<string>`DATE(${orders.createdAt})`,
        total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.vendorId, vendorId),
          notInArray(orders.status, excludedStatuses),
          sql`${orders.createdAt} >= NOW() - INTERVAL '14 days'`,
        ),
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    // En çok satan 5 ürün (adet bazlı)
    const topProducts = await db
      .select({
        productId: products.id,
        name: products.name,
        totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
        totalRevenue: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), notInArray(orders.status, excludedStatuses)))
      .groupBy(products.id, products.name)
      .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
      .limit(5);

    return reply.send({ dailySales, topProducts });
  });
};

export default vendorReportsRoutes;
