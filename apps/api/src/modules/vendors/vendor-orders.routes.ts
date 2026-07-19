import { FastifyPluginAsync } from "fastify";
import { listVendorOrderItems } from "./vendor-orders.repository";
import { orderItemIdParamsSchema, updateOrderItemStatusSchema } from "./vendor-orders.schemas";
import { InvalidStatusTransitionError, OrderItemNotFoundError, transitionOrderItemStatus } from "./vendor-orders.service";

const vendorOrdersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/orders", { preHandler: app.requireVendor }, async (request, reply) => {
    reply.send(await listVendorOrderItems(request.session.vendorId!));
  });

  app.patch("/vendor/orders/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = orderItemIdParamsSchema.parse(request.params);
    const { status } = updateOrderItemStatusSchema.parse(request.body);
    try {
      const updated = await transitionOrderItemStatus(request.session.vendorId!, id, status);
      reply.send(updated);
    } catch (err) {
      if (err instanceof OrderItemNotFoundError) {
        reply.status(404).send({ error: { message: "Sipariş kalemi bulunamadı" } });
        return;
      }
      if (err instanceof InvalidStatusTransitionError) {
        reply.status(409).send({ error: { message: err.message } });
        return;
      }
      throw err;
    }
  });
};

export default vendorOrdersRoutes;
