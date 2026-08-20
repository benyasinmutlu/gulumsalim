import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  addPromoBannerImage,
  approvePromoBanner,
  deletePromoBanner,
  deletePromoBannerImage,
  getPromoBannerStats,
  insertPromoBanner,
  listAllPromoBanners,
  listPromoBannerImages,
  rejectPromoBanner,
  updatePromoBanner,
} from "./admin-content.repository";
import { contentIdParamsSchema, createPromoBannerQuerySchema, updatePromoBannerSchema } from "./admin-content.schemas";
import { createNotification } from "../notifications/notifications.repository";

const rejectBannerSchema = z.object({ rejectionNote: z.string().optional() });
const promoBannerImageIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

const adminPromoBannersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/promo-banners", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllPromoBanners());
  });

  app.post("/admin/promo-banners", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { title, linkUrl, linkType, animStyle, subtitle, buttonText, textColor, rotateSeconds } = createPromoBannerQuerySchema.parse(
      request.query,
    );
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    }
    const buffer = await file.toBuffer();

    try {
      const image = await saveImage("site/promo-banners", buffer, file.mimetype);
      const existing = await listAllPromoBanners();
      const banner = await insertPromoBanner({
        title,
        image,
        linkUrl,
        linkType,
        animStyle,
        subtitle,
        buttonText,
        textColor,
        rotateSeconds,
        sortOrder: existing.length,
      });
      return reply.status(201).send(banner);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.patch("/admin/promo-banners/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const input = updatePromoBannerSchema.parse(request.body);
    const updated = await updatePromoBanner(id, input);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    }
    return reply.send(updated);
  });

  app.delete("/admin/promo-banners/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const deleted = await deletePromoBanner(id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    }
    return reply.send({ ok: true });
  });

  // gulumsalim.com'daki admin/promo-banners.php'nin onay/red aksiyonlarının
  // karşılığı - sadece satıcının gönderdiği bannerlar için anlamlı.
  app.post(
    "/admin/promo-banners/:id/approve",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = contentIdParamsSchema.parse(request.params);
      const banner = await approvePromoBanner(id);
      if (!banner) return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
      if (banner.vendorId) {
        await createNotification(
          banner.vendorId,
          "banner_approved",
          "Kampanya Bannerınız Onaylandı",
          `"${banner.title}" bannerınız onaylandı ve anasayfada yayında.`,
          "/satici/panel/kampanyalar",
        );
      }
      return reply.send(banner);
    },
  );

  app.post(
    "/admin/promo-banners/:id/reject",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = contentIdParamsSchema.parse(request.params);
      const { rejectionNote } = rejectBannerSchema.parse(request.body ?? {});
      const banner = await rejectPromoBanner(id, rejectionNote);
      if (!banner) return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
      if (banner.vendorId) {
        await createNotification(
          banner.vendorId,
          "banner_rejected",
          "Kampanya Bannerınız Reddedildi",
          `"${banner.title}" bannerınız reddedildi.${rejectionNote ? ` Not: ${rejectionNote}` : ""}`,
          "/satici/panel/kampanyalar",
        );
      }
      return reply.send(banner);
    },
  );

  // admin/promo-banners.php'deki "Ek Görseller (döngü için)" özelliğinin
  // karşılığı - bannerın ana görseline ek olarak anasayfada rotate_seconds
  // aralıklarla dönen ek görseller.
  app.get(
    "/admin/promo-banners/:id/images",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const { id } = contentIdParamsSchema.parse(request.params);
      return reply.send(await listPromoBannerImages(id));
    },
  );

  app.post(
    "/admin/promo-banners/:id/images",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = contentIdParamsSchema.parse(request.params);
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
      }
      const buffer = await file.toBuffer();
      try {
        const image = await saveImage("site/promo-banners", buffer, file.mimetype);
        const row = await addPromoBannerImage(id, image);
        return reply.status(201).send(row);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply.status(400).send({ error: { message: err.message } });
        }
        throw err;
      }
    },
  );

  app.delete(
    "/admin/promo-banners/:id/images/:imageId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { imageId } = promoBannerImageIdParamsSchema.parse(request.params);
      const deleted = await deletePromoBannerImage(imageId);
      if (!deleted) return reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  // admin/promo-banners.php'deki tıklama-istatistik panelinin karşılığı.
  app.get("/admin/promo-banners/:id/stats", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const stats = await getPromoBannerStats(id);
    if (!stats) return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    return reply.send(stats);
  });
};

export default adminPromoBannersRoutes;
