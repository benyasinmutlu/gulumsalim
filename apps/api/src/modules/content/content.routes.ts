import { FastifyPluginAsync } from "fastify";
import {
  findPublicPageBySlug,
  getPublicSettings,
  listActiveHomepageCollections,
  listActivePromoBanners,
  listActiveSliders,
  listFooterPages,
} from "./content.repository";
import { insertContactMessage } from "./contact.repository";
import { createContactMessageSchema } from "./contact.schemas";

// Footer'da gösterilen site iletişim/sosyal medya bilgisi - hepsi
// opsiyonel, admin panelden settings tablosuna yazılır (bkz. `settings`
// şeması). Buradaki liste, dışarı açılan alanların ALLOWLIST'i.
const PUBLIC_SETTING_KEYS = [
  "site_name",
  "site_email",
  "site_phone",
  "site_whatsapp",
  "site_instagram",
  "site_facebook",
  "site_address",
  "footer_about",
  "site_logo",
  "color_primary",
  "color_primary_dark",
  "color_secondary",
  "color_accent",
  "shipping_cost",
  "free_shipping_limit",
  "meta_title",
  "meta_description",
  "contact_intro",
  "contact_hours",
  "ga_measurement_id",
  "gtm_container_id",
  "meta_pixel_id",
  "hero_height_desktop",
  "hero_height_mobile",
  "hero_interval_ms",
];

// Admin panelde (bkz. modules/admin/admin-pages.* ve ileride slider/banner
// modülleri) yönetilen içeriğin herkese açık, kimlik doğrulaması
// gerektirmeyen okuma uçları burada.
const contentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/pages/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const page = await findPublicPageBySlug(slug);
    if (!page) {
      return reply.status(404).send({ error: { message: "Sayfa bulunamadı" } });
    }
    return reply.send(page);
  });

  app.get("/footer-pages", async (_request, reply) => {
    return reply.send(await listFooterPages());
  });

  app.get("/sliders", async (_request, reply) => {
    return reply.send(await listActiveSliders());
  });

  app.get("/promo-banners", async (_request, reply) => {
    return reply.send(await listActivePromoBanners());
  });

  app.get("/site-settings", async (_request, reply) => {
    return reply.send(await getPublicSettings(PUBLIC_SETTING_KEYS));
  });

  app.get("/homepage-collections", async (_request, reply) => {
    return reply.send(await listActiveHomepageCollections());
  });

  // Herkese açık iletişim formu - eski sitedeki contact.php'nin karşılığı.
  // csrfProtection eklenmedi çünkü ziyaretçi henüz hiçbir oturuma sahip
  // olmayabilir (misafir); spam riskine karşı admin panelde moderasyon var.
  app.post("/contact", async (request, reply) => {
    const { name, email, message } = createContactMessageSchema.parse(request.body);
    const row = await insertContactMessage(name, email, message);
    return reply.status(201).send(row);
  });
};

export default contentRoutes;
