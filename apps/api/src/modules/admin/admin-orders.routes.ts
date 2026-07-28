import { FastifyPluginAsync } from "fastify";
import { findOrderDetail, listAllOrders } from "./admin-orders.repository";
import { orderIdParamsSchema, orderListQuerySchema } from "./admin-orders.schemas";

const adminOrdersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/orders", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = orderListQuerySchema.parse(request.query);
    return reply.send(await listAllOrders(status));
  });

  app.get("/admin/orders/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = orderIdParamsSchema.parse(request.params);
    const order = await findOrderDetail(id);
    if (!order) return reply.status(404).send({ error: { message: "Sipariş bulunamadı" } });
    return reply.send(order);
  });
};

export default adminOrdersRoutes;
