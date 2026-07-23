import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  deleteVendorPromoBanner,
  getVendorBannerStats,
  insertVendorPromoBanner,
  listVendorPromoBanners,
  updateVendorPromoBanner,
} from "./vendor-promo-banners.repository";
import {
  contentIdParamsSchema,
  createPromoBannerQuerySchema,
  updatePromoBannerSchema,
} from "../admin/admin-content.schemas";

const vendorPromoBannersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/promo-banners", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorPromoBanners(request.session.vendorId!));
  });

  app.post("/vendor/promo-banners", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
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
      const vendorId = request.session.vendorId!;
      const existing = await listVendorPromoBanners(vendorId);
      const banner = await insertVendorPromoBanner(vendorId, {
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

  app.patch("/vendor/promo-banners/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const input = updatePromoBannerSchema.parse(request.body);
    const updated = await updateVendorPromoBanner(request.session.vendorId!, id, input);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    }
    return reply.send(updated);
  });

  app.delete("/vendor/promo-banners/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const deleted = await deleteVendorPromoBanner(request.session.vendorId!, id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    }
    return reply.send({ ok: true });
  });

  // bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı kaç kişi tıkladı
  // ... aldıysa veya favoriye eklediyse de göster".
  app.get("/vendor/promo-banners/:id/stats", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = contentIdParamsSchema.parse(request.params);
    const stats = await getVendorBannerStats(request.session.vendorId!, id);
    if (!stats) return reply.status(404).send({ error: { message: "Banner bulunamadı" } });
    return reply.send(stats);
  });
};

export default vendorPromoBannersRoutes;
