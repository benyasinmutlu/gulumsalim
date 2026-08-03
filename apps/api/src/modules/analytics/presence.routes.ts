import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { recordPresencePing } from "./presence";
import { recordContentEvent } from "./content-analytics.repository";

const pingSchema = z.object({ path: z.string().max(300).optional() });
const dwellSchema = z.object({ productId: z.coerce.number().int().positive(), ms: z.coerce.number().min(0) });
const trackSchema = z.object({
  contentType: z.enum(["category", "homepage_section"]),
  contentId: z.coerce.number().int().positive(),
  eventType: z.enum(["view", "dwell"]),
  value: z.coerce.number().min(0).optional(),
});

// sekme açık unutulmuş bir sayfa ortalamayı bozmasın diye kalma süresi
// üst sınırla kırpılır (bkz. dwell-tracker.tsx, section-analytics-tracker.tsx).
const MAX_DWELL_MS = 10 * 60 * 1000;

// bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
// görebilmeliyim ... hangi üründe nerde kaç saniye duruldu" - hem giriş
// yapmış hem misafir HER ziyaretçiden gelen hafif bir heartbeat/dwell
// sinyali, bu yüzden auth/CSRF gerektirmez (bkz. presence-heartbeat.tsx,
// urun/[slug] dwell-tracker.tsx, section-analytics-tracker.tsx).
const presenceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/presence/ping", async (request, reply) => {
    const { path } = pingSchema.parse(request.body ?? {});
    recordPresencePing(app.redis, request.session.sessionId, path).catch(() => {});
    return reply.send({ ok: true });
  });

  app.post("/analytics/dwell", async (request, reply) => {
    const { productId, ms } = dwellSchema.parse(request.body ?? {});
    const clamped = Math.max(0, Math.min(ms, MAX_DWELL_MS));
    recordContentEvent("product", productId, "dwell", clamped).catch(() => {});
    return reply.send({ ok: true });
  });

  // bkz. kullanıcı isteği: "kategoriler sayfalar ... koleksiyonlar mağazalar
  // kampanyalar" - koleksiyon/mağaza görüntülenmesi kendi API rotalarında
  // (public-vendors.routes.ts) doğrudan sayılıyor; kategori sayfasının API'de
  // kendine özel bir ucu olmadığından (bkz. [slug]/page.tsx) ve anasayfa
  // bölümü izleyicisinin istemci tarafı olması gerektiğinden (görünürlük
  // IntersectionObserver ile ölçülüyor) bu genel uç ikisi için kullanılır.
  app.post("/analytics/track", async (request, reply) => {
    const { contentType, contentId, eventType, value } = trackSchema.parse(request.body ?? {});
    const clampedValue = eventType === "dwell" ? Math.max(0, Math.min(value ?? 0, MAX_DWELL_MS)) : 1;
    recordContentEvent(contentType, contentId, eventType, clampedValue).catch(() => {});
    return reply.send({ ok: true });
  });
};

export default presenceRoutes;
