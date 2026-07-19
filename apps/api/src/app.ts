import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { sql } from "drizzle-orm";
import { db } from "./db/client";
import redisPlugin from "./plugins/redis";
import errorHandlerPlugin from "./plugins/error-handler";
import sessionPlugin from "./plugins/session";
import csrfPlugin from "./plugins/csrf";
import authGuardPlugin from "./plugins/auth-guard";
import authRoutes from "./modules/auth/auth.routes";
import catalogRoutes from "./modules/catalog/catalog.routes";
import cartRoutes from "./modules/cart/cart.routes";
import checkoutRoutes from "./modules/orders/checkout.routes";
import vendorAuthRoutes from "./modules/vendors/vendor-auth.routes";
import vendorProductsRoutes from "./modules/vendors/vendor-products.routes";
import vendorOrdersRoutes from "./modules/vendors/vendor-orders.routes";
import vendorFinanceRoutes from "./modules/vendors/vendor-finance.routes";
import adminAuthRoutes from "./modules/admin/admin-auth.routes";
import adminVendorsRoutes from "./modules/admin/admin-vendors.routes";
import adminPayoutsRoutes from "./modules/admin/admin-payouts.routes";
import uploadPlugin from "./plugins/upload";

export function buildApp() {
  const app = Fastify({
    logger: true,
    // nginx TLS'i sonlandırıp API'ye 127.0.0.1 üzerinden düz HTTP ile
    // proxy yapıyor. trustProxy olmadan Fastify isteği "http" sanır ve
    // secure:true session çerezini hiç göndermez (bkz. plugins/session.ts) -
    // bu satır olmadan prod'da oturum çerezi asla oluşmaz.
    trustProxy: true,
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
  app.register(errorHandlerPlugin);
  app.register(sessionPlugin);
  app.register(csrfPlugin);
  app.register(authGuardPlugin);
  app.register(uploadPlugin);

  app.register(authRoutes);
  app.register(catalogRoutes);
  app.register(cartRoutes);
  app.register(checkoutRoutes);
  app.register(vendorAuthRoutes);
  app.register(vendorProductsRoutes);
  app.register(vendorOrdersRoutes);
  app.register(vendorFinanceRoutes);
  app.register(adminAuthRoutes);
  app.register(adminVendorsRoutes);
  app.register(adminPayoutsRoutes);

  // Deploy sonrası doğrulama ve systemd/uptime izleme için: hem Postgres
  // hem Redis'e gerçekten bağlanabildiğini kontrol eder, sadece process'in
  // ayakta olduğunu değil.
  app.get("/healthz", async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([
      db.execute(sql`SELECT 1`).then(() => true).catch(() => false),
      app.redis.ping().then(() => true).catch(() => false),
    ]);

    const healthy = dbOk && redisOk;
    reply.status(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "degraded",
      checks: { database: dbOk, redis: redisOk },
    });
  });

  return app;
}
