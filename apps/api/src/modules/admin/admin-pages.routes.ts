import { FastifyPluginAsync } from "fastify";
import { deletePage, findPageBySlug, insertPage, listPages, updatePage } from "./admin-pages.repository";
import { createPageSchema, pageIdParamsSchema, updatePageSchema } from "./admin-pages.schemas";

const adminPagesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/pages", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listPages());
  });

  app.post("/admin/pages", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createPageSchema.parse(request.body);
    const existing = await findPageBySlug(input.slug);
    if (existing) {
      return reply.status(409).send({ error: { message: "Bu sayfa adresi zaten kullanılıyor" } });
    }
    const page = await insertPage(input);
    return reply.status(201).send(page);
  });

  app.patch("/admin/pages/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = pageIdParamsSchema.parse(request.params);
    const input = updatePageSchema.parse(request.body);

    if (input.slug) {
      const existing = await findPageBySlug(input.slug);
      if (existing && existing.id !== id) {
        return reply.status(409).send({ error: { message: "Bu sayfa adresi zaten kullanılıyor" } });
      }
    }

    const updated = await updatePage(id, input);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Sayfa bulunamadı" } });
    }
    return reply.send(updated);
  });

  app.delete("/admin/pages/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = pageIdParamsSchema.parse(request.params);
    const deleted = await deletePage(id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Sayfa bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminPagesRoutes;
