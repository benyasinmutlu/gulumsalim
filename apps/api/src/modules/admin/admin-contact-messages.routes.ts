import { FastifyPluginAsync } from "fastify";
import { deleteContactMessage, listContactMessages, markContactMessageRead } from "../content/contact.repository";
import { contactMessageIdParamsSchema } from "../content/contact.schemas";

const adminContactMessagesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/contact-messages", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listContactMessages());
  });

  app.patch(
    "/admin/contact-messages/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = contactMessageIdParamsSchema.parse(request.params);
      const row = await markContactMessageRead(id);
      if (!row) return reply.status(404).send({ error: { message: "Mesaj bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  app.delete(
    "/admin/contact-messages/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = contactMessageIdParamsSchema.parse(request.params);
      const deleted = await deleteContactMessage(id);
      if (!deleted) return reply.status(404).send({ error: { message: "Mesaj bulunamadı" } });
      return reply.send({ ok: true });
    },
  );
};

export default adminContactMessagesRoutes;
