import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  addSectionBanner,
  deleteSection,
  insertSection,
  isSeoSlugTaken,
  listAllSections,
  listSectionBanners,
  removeSectionBanner,
  reorderSectionBanners,
  updateSection,
} from "../homepage-sections/homepage-sections.repository";
import { previewSectionConfig } from "../homepage-sections/homepage-sections.service";
import {
  createSectionSchema,
  sectionBannerBodySchema,
  sectionBannerReorderSchema,
  sectionIdParamsSchema,
  updateSectionSchema,
} from "./admin-homepage-sections.schemas";

const previewSchema = z.object({
  algoType: z.string(),
  config: z.record(z.string(), z.unknown()).default({}),
  sectionId: z.number().int().positive().optional(),
});

const adminHomepageSectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/homepage-sections", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllSections());
  });

  app.post(
    "/admin/homepage-sections",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const input = createSectionSchema.parse(request.body);
      if (input.seoSlug && (await isSeoSlugTaken(input.seoSlug))) {
        return reply.status(409).send({ error: { message: "Bu SEO adresi zaten kullanılıyor" } });
      }
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
      if (input.seoSlug && (await isSeoSlugTaken(input.seoSlug, id))) {
        return reply.status(409).send({ error: { message: "Bu SEO adresi zaten kullanılıyor" } });
      }
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

  // homepage-sections.php'deki "Kampanya Bannerları" bölümüne özel banner
  // seçimi/sıralaması - bkz. homepage-sections.repository.ts.
  app.get(
    "/admin/homepage-sections/:id/banners",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      return reply.send(await listSectionBanners(id));
    },
  );

  app.post(
    "/admin/homepage-sections/:id/banners",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      const { bannerId } = sectionBannerBodySchema.parse(request.body);
      await addSectionBanner(id, bannerId);
      return reply.status(201).send({ ok: true });
    },
  );

  app.delete(
    "/admin/homepage-sections/:id/banners/:bannerId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      const { bannerId } = request.params as { bannerId: string };
      await removeSectionBanner(id, Number(bannerId));
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/admin/homepage-sections/:id/banners/reorder",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = sectionIdParamsSchema.parse(request.params);
      const { bannerIds } = sectionBannerReorderSchema.parse(request.body);
      await reorderSectionBanners(id, bannerIds);
      return reply.send({ ok: true });
    },
  );

  // homepage-preview-render.php'nin karşılığı - admin panelde henüz
  // kaydedilmemiş form değerleriyle canlı önizleme.
  app.post("/admin/homepage-sections/preview", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { algoType, config, sectionId } = previewSchema.parse(request.body);
    const result = await previewSectionConfig(app.redis, undefined, algoType, config, sectionId);
    return reply.send(result);
  });
};

export default adminHomepageSectionsRoutes;
