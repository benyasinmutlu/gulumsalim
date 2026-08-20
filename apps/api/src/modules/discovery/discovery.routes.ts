import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getDiscoverFeed } from "./discovery.service";
import { findMostViewedProductIds, findProductsByIds, findTopViewedCategories } from "../catalog/catalog.repository";
import { computeBestSellingProductIds } from "../homepage-sections/homepage-sections.repository";
import { recordDiscoverFeedback } from "../recommendation/discover/discover.repository";
import { validateEventBatch } from "../recommendation/discover/event-security";
import { recordTrustedEvents } from "../recommendation/discover/tracking.repository";

// Keşif etkileşim takibi (impression/click…). Kimlik body'den DEĞİL session'dan;
// batch ≤50; purchase gibi güvenilir-yalnız event'ler reddedilir (event-security).
const trackSchema = z.object({
  // Anonim kullanıcı için kalıcı istemci kimliği (localStorage UUID). Giriş
  // yapılmışsa yok sayılır (kimlik customerId'den). Anon dedup + CTR bunu kullanır.
  anonId: z.string().min(1).max(64).optional(),
  events: z
    .array(
      z.object({
        type: z.string().max(32),
        productId: z.number().int().positive().optional(),
        vendorId: z.number().int().positive().optional(),
        categoryId: z.number().int().positive().optional(),
        occurredAt: z.number().optional(),
        source: z.string().max(40).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .max(50),
});

// "İlgilenmiyorum/Gizle" — ürün VEYA kategori (biri zorunlu, ikisi birden değil).
const feedbackSchema = z
  .object({
    productId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => (v.productId != null) !== (v.categoryId != null), {
    message: "productId veya categoryId'den tam olarak biri gerekli",
  });

const discoveryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/discover", async (request, reply) => {
    try {
      const feed = await getDiscoverFeed(request.session.customerId, 12);
      return reply.send(feed);
    } catch (err) {
      // Keşfet servisi geçici olarak erişilemez olsa bile ana sayfa
      // çökmemeli - boş bir bölüm olarak sessizce düşer.
      request.log.warn({ err }, "keşfet akışı alınamadı");
      return reply.send({ items: [], strategy: "unavailable" });
    }
  });

  // bkz. kullanıcı isteği: "/sana-ozel sayfasında ... altında en çok
  // bakılan ürünler kategoriler ... listele, diğer bölümler için de
  // algoritma oluştur" - kişiselleştirilmiş akışın altına eklenen, doğrudan
  // SQL'den hesaplanan üç ek bölüm (en çok bakılan ürün/kategori, çok satan).
  app.get("/discover/trending", async (_request, reply) => {
    const [mostViewedIds, bestSellerIds, topCategories] = await Promise.all([
      findMostViewedProductIds(12),
      computeBestSellingProductIds(12),
      findTopViewedCategories(6),
    ]);
    const [mostViewed, bestSellers] = await Promise.all([
      findProductsByIds(mostViewedIds),
      findProductsByIds(bestSellerIds),
    ]);
    return reply.send({ mostViewed, bestSellers, topCategories });
  });

  // "İlgilenmiyorum/Gizle" — keşif kalitesini kişisel negatif sinyalle artırır.
  // Discover v1 flag'inden bağımsız çalışır (sinyal erkenden toplanabilir).
  // Etkileşim takibi (gösterim/tıklama). Anonim de izlenir (session_id). Kimlik
  // + consent server'da; motorun A/B ölçümü (CTR) + geri beslemesi için.
  app.post("/discover/track", async (request, reply) => {
    const parsed = trackSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: { message: "Geçersiz event verisi" } });
    const session = request.session as { customerId?: number; sessionId?: string } | undefined;
    // Giriş yapılmışsa kimlik customerId'den (sessionId önemsiz). Anon ise
    // kalıcı anonId tercih edilir (istemci localStorage); yoksa best-effort session.
    const sessionId = session?.customerId != null ? (session?.sessionId ?? "anon") : (parsed.data.anonId ?? session?.sessionId ?? "anon");
    const { accepted, rejected } = validateEventBatch(parsed.data.events, {
      sessionCustomerId: session?.customerId,
      sessionId,
      nowMs: Date.now(),
      consentPersonalization: session?.customerId != null,
    });
    if (accepted.length > 0) await recordTrustedEvents(accepted).catch(() => {});
    return reply.send({ accepted: accepted.length, rejected: rejected.length });
  });

  app.post("/discover/feedback", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const input = feedbackSchema.parse(request.body);
    await recordDiscoverFeedback(request.session.customerId!, input);
    return reply.send({ ok: true });
  });
};

export default discoveryRoutes;
