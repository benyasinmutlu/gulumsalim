import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import redisPlugin from "./plugins/redis";
import loginRateLimitPlugin from "./plugins/login-rate-limit";
import errorHandlerPlugin from "./plugins/error-handler";
import sessionPlugin from "./plugins/session";
import csrfPlugin from "./plugins/csrf";
import authGuardPlugin from "./plugins/auth-guard";
import authRoutes from "./modules/auth/auth.routes";
import catalogRoutes from "./modules/catalog/catalog.routes";
import cartRoutes from "./modules/cart/cart.routes";
import checkoutRoutes from "./modules/orders/checkout.routes";
import customerRefundsRoutes from "./modules/orders/customer-refunds.routes";
import vendorAuthRoutes from "./modules/vendors/vendor-auth.routes";
import vendorProductsRoutes from "./modules/vendors/vendor-products.routes";
import vendorOrdersRoutes from "./modules/vendors/vendor-orders.routes";
import vendorFinanceRoutes from "./modules/vendors/vendor-finance.routes";
import publicVendorsRoutes from "./modules/vendors/public-vendors.routes";
import adminAuthRoutes from "./modules/admin/admin-auth.routes";
import adminVendorsRoutes from "./modules/admin/admin-vendors.routes";
import adminPayoutsRoutes from "./modules/admin/admin-payouts.routes";
import adminPagesRoutes from "./modules/admin/admin-pages.routes";
import adminSlidersRoutes from "./modules/admin/admin-sliders.routes";
import adminPromoBannersRoutes from "./modules/admin/admin-promo-banners.routes";
import adminHomepageSectionsRoutes from "./modules/admin/admin-homepage-sections.routes";
import contentRoutes from "./modules/content/content.routes";
import discoveryRoutes from "./modules/discovery/discovery.routes";
import discoverV1Routes from "./modules/recommendation/discover/discover.v1.routes";
import { buildProductionDiscoverRuntime } from "./modules/recommendation/discover/discover.repository";
import reviewsRoutes from "./modules/reviews/reviews.routes";
import vendorReviewsRoutes from "./modules/reviews/vendor-reviews.routes";
import adminReviewsRoutes from "./modules/admin/admin-reviews.routes";
import adminQuestionsRoutes from "./modules/admin/admin-questions.routes";
import adminVendorReviewsRoutes from "./modules/admin/admin-vendor-reviews.routes";
import adminVendorComplaintsRoutes from "./modules/admin/admin-vendor-complaints.routes";
import adminSiteFeedbackRoutes from "./modules/admin/admin-site-feedback.routes";
import questionsRoutes from "./modules/questions/questions.routes";
import vendorQuestionsRoutes from "./modules/questions/vendor-questions.routes";
import homepageSectionsRoutes from "./modules/homepage-sections/homepage-sections.routes";
import uploadPlugin from "./plugins/upload";
import adminCategoriesRoutes from "./modules/admin/admin-categories.routes";
import adminProductsRoutes from "./modules/admin/admin-products.routes";
import adminCustomersRoutes from "./modules/admin/admin-customers.routes";
import adminOrdersRoutes from "./modules/admin/admin-orders.routes";
import adminRefundsRoutes from "./modules/admin/admin-refunds.routes";
import adminContactMessagesRoutes from "./modules/admin/admin-contact-messages.routes";
import messagingRoutes from "./modules/messaging/messaging.routes";
import customerMessagingRoutes from "./modules/messaging/customer-messaging.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import vendorCollectionsRoutes from "./modules/vendors/vendor-collections.routes";
import vendorCategoriesRoutes from "./modules/vendors/vendor-categories.routes";
import vendorBulkImportRoutes from "./modules/vendors/vendor-bulk-import.routes";
import vendorStoreLayoutRoutes from "./modules/vendors/vendor-store-layout.routes";
import vendorStoreContentRoutes from "./modules/vendors/vendor-store-content.routes";
import vendorDashboardRoutes from "./modules/vendors/vendor-dashboard.routes";
import vendorReportsRoutes from "./modules/vendors/vendor-reports.routes";
import customerAddressesRoutes from "./modules/customers/customer-addresses.routes";
import adminSettingsRoutes from "./modules/admin/admin-settings.routes";
import adminHomepageCollectionsRoutes from "./modules/admin/admin-homepage-collections.routes";
import vendorPromoBannersRoutes from "./modules/vendors/vendor-promo-banners.routes";
import adminDashboardRoutes from "./modules/admin/admin-dashboard.routes";

export function buildApp() {
  const app = Fastify({
    logger: true,
    // nginx TLS'i sonlandırıp API'ye 127.0.0.1 üzerinden düz HTTP ile
    // proxy yapıyor. trustProxy olmadan Fastify isteği "http" sanır ve
    // secure:true session çerezini hiç göndermez (bkz. plugins/session.ts) -
    // bu ayar olmadan prod'da oturum çerezi asla oluşmaz.
    //
    // GÜVENLİK (CLAUDE-013): `true` DEĞİL, `'loopback'`. `true` tüm
    // X-Forwarded-For zincirine güvenip request.ip'yi en soldaki (istemci-
    // kontrollü) değere eşitler; login-rate-limit request.ip'ye key'lendiğinden
    // saldırgan sahte X-Forwarded-For ile limiti bypass eder. 'loopback'
    // yalnız nginx'e (127.0.0.1) güvenir; request.ip gerçek istemci IP'si olur.
    trustProxy: "loopback",
  });

  // origin:true, isteğin kendi Origin header'ını yansıtır - nginx arkasında
  // (tek origin) prod'da zaten devreye girmez, sadece Next.js dev server'ın
  // API'den farklı porttan çalıştığı yerel geliştirmede işe yarar.
  app.register(cors, { origin: true, credentials: true });
  // iyzico ödeme sonucu callback'ini form-encoded (application/x-www-form-
  // urlencoded) POST ile gönderir - Fastify varsayılan olarak sadece JSON
  // gövdesini ayrıştırır.
  app.register(formbody);
  app.register(redisPlugin);
  app.register(loginRateLimitPlugin);
  app.register(errorHandlerPlugin);
  app.register(sessionPlugin);
  app.register(csrfPlugin);
  app.register(authGuardPlugin);
  app.register(uploadPlugin);

  app.register(authRoutes);
  app.register(catalogRoutes);
  app.register(cartRoutes);
  app.register(checkoutRoutes);
  app.register(customerRefundsRoutes);
  app.register(vendorAuthRoutes);
  app.register(vendorProductsRoutes);
  app.register(vendorOrdersRoutes);
  app.register(vendorFinanceRoutes);
  app.register(publicVendorsRoutes);
  app.register(adminAuthRoutes);
  app.register(adminVendorsRoutes);
  app.register(adminPayoutsRoutes);
  app.register(adminPagesRoutes);
  app.register(adminSlidersRoutes);
  app.register(adminPromoBannersRoutes);
  app.register(adminHomepageSectionsRoutes);
  app.register(contentRoutes);
  app.register(discoveryRoutes);
  // Personalized Discover v1 — flag arkasında (varsayılan KAPALI). Mevcut Go
  // /discover davranışını değiştirmez; yalnız DISCOVER_V1_ENABLED=true iken
  // /v1/discover ek endpoint'i açılır (allowlist/test hesabı ile doğrulama).
  if (process.env.DISCOVER_V1_ENABLED === "true") {
    app.register(discoverV1Routes, { runtime: buildProductionDiscoverRuntime() });
  }
  app.register(reviewsRoutes);
  app.register(vendorReviewsRoutes);
  app.register(adminReviewsRoutes);
  app.register(adminQuestionsRoutes);
  app.register(adminVendorReviewsRoutes);
  app.register(adminVendorComplaintsRoutes);
  app.register(adminSiteFeedbackRoutes);
  app.register(questionsRoutes);
  app.register(vendorQuestionsRoutes);
  app.register(homepageSectionsRoutes);
  app.register(adminCategoriesRoutes);
  app.register(adminProductsRoutes);
  app.register(adminCustomersRoutes);
  app.register(adminOrdersRoutes);
  app.register(adminRefundsRoutes);
  app.register(adminContactMessagesRoutes);
  app.register(messagingRoutes);
  app.register(customerMessagingRoutes);
  app.register(notificationsRoutes);
  app.register(vendorCollectionsRoutes);
  app.register(vendorCategoriesRoutes);
  app.register(vendorBulkImportRoutes);
  app.register(vendorStoreLayoutRoutes);
  app.register(vendorStoreContentRoutes);
  app.register(vendorDashboardRoutes);
  app.register(vendorReportsRoutes);
  app.register(customerAddressesRoutes);
  app.register(adminSettingsRoutes);
  app.register(adminHomepageCollectionsRoutes);
  app.register(vendorPromoBannersRoutes);
  app.register(adminDashboardRoutes);

  // Deploy sonrası doğrulama ve systemd/uptime izleme için: hem Postgres
  // hem Redis'e gerçekten bağlanabildiğini kontrol eder, sadece process'in
  // ayakta olduğunu değil.
  app.get("/healthz", async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
      app.redis.ping().then(() => true).catch(() => false),
    ]);

    const healthy = dbOk && redisOk;
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      checks: { database: dbOk, redis: redisOk },
    });
  });

  return app;
}
