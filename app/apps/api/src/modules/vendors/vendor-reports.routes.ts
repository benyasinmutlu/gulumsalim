import { FastifyPluginAsync } from "fastify";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, products, vendorEarnings } from "../../db/schema/index";

const vendorReportsRoutes: FastifyPluginAsync = async (app) => {
  // vendor/reports.php'nin karşılığı: genel özet stat kartları + son 6 ay
  // ciro grafiği (eski 14-günlük tablo yerine boot.php'deki gerçek rapor).
  app.get("/vendor/reports", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const excludedStatuses: ("cancelled" | "refunded")[] = ["cancelled", "refunded"];

    const [summary] = await db
      .select({
        gross: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
        qty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.vendorId, vendorId), notInArray(orders.status, excludedStatuses)));

    const [netRow] = await db
      .select({ net: sql<string>`COALESCE(SUM(${vendorEarnings.netAmount}), 0)` })
      .from(vendorEarnings)
      .where(eq(vendorEarnings.vendorId, vendorId));

    const [monthRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.vendorId, vendorId),
          notInArray(orders.status, excludedStatuses),
          sql`date_trunc('month', ${orders.createdAt}) = date_trunc('month', now())`,
        ),
      );

    // Son 6 ay, aylık ciro (grafik için)
    const monthlySales = await db
      .select({
        month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
        total: sql<string>`COALESCE(SUM(${orderItems.total}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.vendorId, vendorId),
          notInArray(orders.status, excludedStatuses),
          sql`${orders.createdAt} >= now() - interval '6 months'`,
        ),
      )
      .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`);

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

    return reply.send({
      totalRevenue: summary?.gross ?? "0",
      netEarnings: netRow?.net ?? "0",
      monthRevenue: monthRow?.total ?? "0",
      totalOrders: summary?.orders ?? 0,
      totalQuantity: summary?.qty ?? 0,
      monthlySales,
      topProducts,
    });
  });
};

export default vendorReportsRoutes;
