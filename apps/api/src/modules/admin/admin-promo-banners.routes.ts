import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import { deletePromoBanner, insertPromoBanner, listAllPromoBanners, updatePromoBanner } from "./admin-content.repository";
import { contentIdParamsSchema, createPromoBannerQuerySchema, updatePromoBannerSchema } from "./admin-content.schemas";

const adminPromoBannersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/promo-banners", { preHandler: app.requireAdmin }, async (_request, reply) => {
    reply.send(await listAllPromoBanners());
  });

  app.post("/admin/promo-banners", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { title, linkUrl } = createPromoBannerQuerySchema.parse(request.query);
    const file = await request.file();
    if (!file) {
      reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
      return;
    }
    const buffer = await file.toBuffer();

    try {
      const image = await saveImage("site/promo-banners", buffer, file.mimetype);
      const existing = await listAllPromoBanners();
      const banner = await insertPromoBanner({ title, image, linkUrl, sortOrder: existing.length });
      reply.status(201).send(banner);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        reply.status(400).send({ error: { message: err.message } });
        return;
      }
      throw err;
    }
  });

  app.patch("/admin/promo-banners/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const input = updatePromoBannerSchema.parse(request.body);
    const updated = await updatePromoBanner(id, input);
    if (!updated) {
      reply.status(404).send({ error: { message: "Banner bulunamadı" } });
      return;
    }
    reply.send(updated);
  });

  app.delete("/admin/promo-banners/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const deleted = await deletePromoBanner(id);
    if (!deleted) {
      reply.status(404).send({ error: { message: "Banner bulunamadı" } });
      return;
    }
    reply.send({ ok: true });
  });
};

export default adminPromoBannersRoutes;
