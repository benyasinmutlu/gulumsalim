import { FastifyPluginAsync } from "fastify";
import {
  deleteSection,
  insertSection,
  listAllSections,
  updateSection,
} from "../homepage-sections/homepage-sections.repository";
import { createSectionSchema, sectionIdParamsSchema, updateSectionSchema } from "./admin-homepage-sections.schemas";

const adminHomepageSectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/homepage-sections", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllSections());
  });

  app.post(
    "/admin/homepage-sections",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const input = createSectionSchema.parse(request.body);
      const section = await insertSection(input);
      return reply.status(201).send(section);
    },
  );

  app.patch(
    "/admin/homepage-sections/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      const input = updateSectionSchema.parse(request.body);
      const updated = await updateSection(id, input);
      if (!updated) {
        return reply.status(404).send({ error: { message: "Bölüm bulunamadı" } });
      }
      return reply.send(updated);
    },
  );

  app.delete(
    "/admin/homepage-sections/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      const deleted = await deleteSection(id);
      if (!deleted) {
        return reply.status(404).send({ error: { message: "Bölüm bulunamadı" } });
      }
      return reply.send({ ok: true });
    },
  );
};

export default adminHomepageSectionsRoutes;
