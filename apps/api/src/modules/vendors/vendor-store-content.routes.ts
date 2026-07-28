import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  deleteVendorSocialPost,
  deleteVendorStoreSlide,
  insertVendorSocialPost,
  insertVendorStoreSlide,
  listVendorSocialPosts,
  listVendorStoreSlides,
} from "./vendor-store-content.repository";

const slideQuerySchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  linkUrl: z.string().optional(),
});

const socialPostSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube"]),
  postUrl: z.string().url(),
  image: z.string().optional(),
  caption: z.string().max(500).optional(),
});

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

// vendor/store-layout.php'deki satıcıya özel slider + sosyal medya
// gönderisi yönetiminin karşılığı.
const vendorStoreContentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/store-slides", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorStoreSlides(request.session.vendorId!));
  });

  app.post("/vendor/store-slides", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { title, subtitle, buttonText, linkUrl } = slideQuerySchema.parse(request.query);
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    const buffer = await file.toBuffer();
    try {
      const image = await saveImage(`vendors/${request.session.vendorId}/slides`, buffer, file.mimetype);
      const slide = await insertVendorStoreSlide(request.session.vendorId!, { image, title, subtitle, buttonText, linkUrl });
      return reply.status(201).send(slide);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.delete("/vendor/store-slides/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const deleted = await deleteVendorStoreSlide(request.session.vendorId!, id);
    if (!deleted) return reply.status(404).send({ error: { message: "Slayt bulunamadı" } });
    return reply.send({ ok: true });
  });

  // Sosyal medya gönderisi kapak görseli için bağımsız yükleme - vendor
  // profile/cover ucundan farklı olarak hiçbir DB satırını güncellemez,
  // sadece dosyayı kaydedip URL döner.
  app.post("/vendor/social-posts/upload-image", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    const buffer = await file.toBuffer();
    try {
      const url = await saveImage(`vendors/${request.session.vendorId}/social`, buffer, file.mimetype);
      return reply.send({ url });
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.get("/vendor/social-posts", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorSocialPosts(request.session.vendorId!));
  });

  app.post("/vendor/social-posts", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = socialPostSchema.parse(request.body);
    const post = await insertVendorSocialPost(request.session.vendorId!, input);
    return reply.status(201).send(post);
  });

  app.delete("/vendor/social-posts/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const deleted = await deleteVendorSocialPost(request.session.vendorId!, id);
    if (!deleted) return reply.status(404).send({ error: { message: "Gönderi bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default vendorStoreContentRoutes;
