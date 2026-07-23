import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  deleteConversation,
  listConversationsForCustomer,
  listConversationsForVendor,
  listThread,
  markThreadRead,
  sendMessage,
} from "./customer-messaging.repository";
import { sendMessageSchema } from "./messaging.schemas";

const vendorIdParamsSchema = z.object({ vendorId: z.coerce.number().int().positive() });
const customerIdParamsSchema = z.object({ customerId: z.coerce.number().int().positive() });

const customerMessagingRoutes: FastifyPluginAsync = async (app) => {
  // Satıcı tarafı: müşterilerinden gelen mesajlar.
  app.get("/vendor/customer-messages", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listConversationsForVendor(request.session.vendorId!));
  });

  app.get("/vendor/customer-messages/:customerId", { preHandler: app.requireVendor }, async (request, reply) => {
    const { customerId } = customerIdParamsSchema.parse(request.params);
    const vendorId = request.session.vendorId!;
    const thread = await listThread(vendorId, customerId);
    await markThreadRead(vendorId, customerId, "vendor");
    return reply.send(thread);
  });

  app.post(
    "/vendor/customer-messages/:customerId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { customerId } = customerIdParamsSchema.parse(request.params);
      const { message } = sendMessageSchema.parse(request.body);
      const row = await sendMessage(request.session.vendorId!, customerId, "vendor", message);
      return reply.status(201).send(row);
    },
  );

  app.delete(
    "/vendor/customer-messages/:customerId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { customerId } = customerIdParamsSchema.parse(request.params);
      await deleteConversation(request.session.vendorId!, customerId);
      return reply.send({ ok: true });
    },
  );

  // Müşteri tarafı: satıcılarla olan konuşmaları.
  app.get("/my/vendor-messages", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listConversationsForCustomer(request.session.customerId!));
  });

  app.get("/my/vendor-messages/:vendorId", { preHandler: app.requireCustomer }, async (request, reply) => {
    const { vendorId } = vendorIdParamsSchema.parse(request.params);
    const customerId = request.session.customerId!;
    const thread = await listThread(vendorId, customerId);
    await markThreadRead(vendorId, customerId, "customer");
    return reply.send(thread);
  });

  app.post(
    "/my/vendor-messages/:vendorId",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { vendorId } = vendorIdParamsSchema.parse(request.params);
      const { message } = sendMessageSchema.parse(request.body);
      const row = await sendMessage(vendorId, request.session.customerId!, "customer", message);
      return reply.status(201).send(row);
    },
  );

  app.delete(
    "/my/vendor-messages/:vendorId",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { vendorId } = vendorIdParamsSchema.parse(request.params);
      await deleteConversation(vendorId, request.session.customerId!);
      return reply.send({ ok: true });
    },
  );
};

export default customerMessagingRoutes;
