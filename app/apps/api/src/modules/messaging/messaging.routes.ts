import { FastifyPluginAsync } from "fastify";
import { deleteThread, listConversationsForAdmin, listThread, markThreadRead, sendMessage } from "./messaging.repository";
import { sendMessageSchema, vendorIdParamsSchema } from "./messaging.schemas";

// Admin <-> Satıcı iki yönlü mesajlaşma. Admin tarafı vendorId parametresiyle
// belirli bir satıcıyla olan konuşmayı görür, satıcı tarafı kendi oturumundan
// (session.vendorId) otomatik çıkarılır.
const messagingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/vendor-messages", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listConversationsForAdmin());
  });

  app.get("/admin/vendor-messages/:vendorId", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { vendorId } = vendorIdParamsSchema.parse(request.params);
    const thread = await listThread(vendorId);
    await markThreadRead(vendorId, "admin");
    return reply.send(thread);
  });

  app.post(
    "/admin/vendor-messages/:vendorId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { vendorId } = vendorIdParamsSchema.parse(request.params);
      const { message } = sendMessageSchema.parse(request.body);
      const row = await sendMessage(vendorId, "admin", message);
      return reply.status(201).send(row);
    },
  );

  app.delete(
    "/admin/vendor-messages/:vendorId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { vendorId } = vendorIdParamsSchema.parse(request.params);
      await deleteThread(vendorId);
      return reply.send({ ok: true });
    },
  );

  app.get("/vendor/messages", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const thread = await listThread(vendorId);
    await markThreadRead(vendorId, "vendor");
    return reply.send(thread);
  });

  app.post("/vendor/messages", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { message } = sendMessageSchema.parse(request.body);
    const row = await sendMessage(request.session.vendorId!, "vendor", message);
    return reply.status(201).send(row);
  });
};

export default messagingRoutes;
