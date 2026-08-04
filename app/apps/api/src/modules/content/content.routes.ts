import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  findPublicPageBySlug,
  getPublicSettings,
  listActiveHomepageCollections,
  listActivePromoBanners,
  listActiveSliders,
  listFooterPages,
  recordPromoBannerEvent,
} from "./content.repository";
import { insertContactMessage } from "./contact.repository";
import { createContactMessageSchema } from "./contact.schemas";
import { insertSiteFeedback } from "./site-feedback.repository";
import { insertCookieConsent } from "./cookie-consent.repository";
import { insertNewsletterSubscriber } from "./newsletter.repository";
import { findFeaturedActiveCoupon } from "../orders/coupon.repository";

const siteFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  category: z.enum(["elestiri", "oneri", "sikayet", "diger"]).optional(),
  message: z.string().min(5).max(2000),
  pageUrl: z.string().max(500).optional(),
});

const cookieConsentSchema = z.object({
  performance: z.boolean(),
  functionality: z.boolean(),
  advertising: z.boolean(),
});

const newsletterSignupSchema = z.object({
  email: z.string().email(),
});

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

  // admin/promo-banners.php'deki tıklama takibinin karşılığı - kimlik
  // doğrulaması/csrf gerektirmez, ziyaretçi bannera tıkladığında ateşlenir.
  app.post("/promo-banners/:id/click", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    await recordPromoBannerEvent(id, "click");
    return reply.status(204).send();
  });

  // bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı" - banner
  // IntersectionObserver ile ekranda göründüğünde bir kere ateşlenir
  // (bkz. components/promo-banner-impression.tsx).
  app.post("/promo-banners/:id/view", async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
    await recordPromoBannerEvent(id, "view");
    return reply.status(204).send();
  });

  app.get("/site-settings", async (_request, reply) => {
    return reply.send(await getPublicSettings(PUBLIC_SETTING_KEYS));
  });

  app.get("/homepage-collections", async (_request, reply) => {
    return reply.send(await listActiveHomepageCollections());
  });

  // Anasayfadaki "İlk Alışverişine Özel İndirim" kartı için - admin'in
  // isFeatured işaretlediği tek aktif kupon (bkz. coupon.repository.ts).
  // Yoksa null döner, kart hiç gösterilmez (sahte/sabit bir kod asla
  // gösterilmez).
  app.get("/coupons/featured", async (_request, reply) => {
    const coupon = await findFeaturedActiveCoupon();
    if (!coupon) return reply.send(null);
    return reply.send({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount,
    });
  });

  // Herkese açık iletişim formu - eski sitedeki contact.php'nin karşılığı.
  // csrfProtection eklenmedi çünkü ziyaretçi henüz hiçbir oturuma sahip
  // olmayabilir (misafir); spam riskine karşı admin panelde moderasyon var.
  app.post("/contact", async (request, reply) => {
    const { name, email, message } = createContactMessageSchema.parse(request.body);
    const row = await insertContactMessage(name, email, message);
    return reply.status(201).send(row);
  });

  // bkz. kullanıcı isteği: "websitesine her giren kişiye eğer belirli bir
  // süre kaldıysa değerlendirme yeri çıkartalım" - site-wide-feedback-
  // widget.tsx belirli bir süre sonra bu uca gönderir. Misafirler de
  // gönderebilir (contact formundaki aynı gerekçe), giriş yapmışsa
  // customerId oturumdan otomatik alınır.
  app.post("/site-feedback", async (request, reply) => {
    const input = siteFeedbackSchema.parse(request.body);
    const row = await insertSiteFeedback({ ...input, customerId: request.session.customerId });
    return reply.status(201).send(row);
  });

  // Çerez tercih paneli (bkz. cookie-consent-banner.tsx) - contact/
  // site-feedback ile aynı gerekçeyle CSRF yok: banner ilk sayfa
  // yüklemesinde çıkabilir, ziyaretçi henüz CSRF token almamış olabilir.
  app.post("/cookie-consent", async (request, reply) => {
    const input = cookieConsentSchema.parse(request.body);
    const row = await insertCookieConsent({
      ...input,
      sessionId: request.session.sessionId,
      customerId: request.session.customerId,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.status(201).send({ id: row.id });
  });

  // Footer bülten kayıt bandı - contact/site-feedback ile aynı gerekçeyle
  // CSRF yok (misafir formu).
  app.post("/newsletter-signup", async (request, reply) => {
    const { email } = newsletterSignupSchema.parse(request.body);
    const row = await insertNewsletterSubscriber(email);
    return reply.status(201).send({ id: row.id });
  });
};

export default contentRoutes;
