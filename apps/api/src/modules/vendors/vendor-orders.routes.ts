import { FastifyPluginAsync } from "fastify";
import { createRefundRequest, listVendorOrderItems, listVendorRefunds } from "./vendor-orders.repository";
import { createRefundRequestSchema, orderItemIdParamsSchema, updateOrderItemStatusSchema } from "./vendor-orders.schemas";
import { InvalidStatusTransitionError, OrderItemNotFoundError, transitionOrderItemStatus } from "./vendor-orders.service";

const vendorOrdersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/orders", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorOrderItems(request.session.vendorId!));
  });

  app.get("/vendor/refunds", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorRefunds(request.session.vendorId!));
  });

  app.post(
    "/vendor/orders/:id/refund-request",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = orderItemIdParamsSchema.parse(request.params);
      const { reason } = createRefundRequestSchema.parse(request.body);
      const row = await createRefundRequest(request.session.vendorId!, id, reason);
      if (!row) return reply.status(404).send({ error: { message: "Sipariş kalemi bulunamadı" } });
      return reply.status(201).send(row);
    },
  );

  app.patch("/vendor/orders/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = orderItemIdParamsSchema.parse(request.params);
    const { status } = updateOrderItemStatusSchema.parse(request.body);
    try {
      const updated = await transitionOrderItemStatus(request.session.vendorId!, id, status);
      return reply.send(updated);
    } catch (err) {
      if (err instanceof OrderItemNotFoundError) {
        return reply.status(404).send({ error: { message: "Sipariş kalemi bulunamadı" } });
      }
      if (err instanceof InvalidStatusTransitionError) {
        return reply.status(409).send({ error: { message: err.message } });
      }
      throw err;
    }
  });
};

export default vendorOrdersRoutes;
