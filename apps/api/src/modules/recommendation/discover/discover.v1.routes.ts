import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ALGORITHM_VERSION, type DiscoverRequest, type DiscoverSurface } from "./contract";
import { cacheHeadersFor, runDiscoverV1, type DiscoverRuntime } from "./runtime";
import { isEligibleForDiscoverV1, parseDiscoverFlags } from "./eligibility";

// =============================================================================
// GET /v1/discover (FAZ 3) — kişiye özel keşfet akışı. Kimlik DAİMA server-side
// session'dan; kişisel yanıt paylaşımlı cache'e girmez; ana sayfa asla 500 vermez.
// Route flag ile app.ts'te koşullu kayıt edilir (varsayılan kapalı).
// =============================================================================

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().min(1).max(512).optional(),
  surface: z.enum(["home", "discover", "pdp"]).default("home"),
});

const EXPERIMENT_ID = "discover-v1";

export interface DiscoverV1Options {
  runtime: DiscoverRuntime;
}

const discoverV1Routes: FastifyPluginAsync<DiscoverV1Options> = async (app, opts) => {
  const { runtime } = opts;

  app.get("/v1/discover", async (request, reply) => {
    // Girdi doğrulama (limit sınırı, cursor uzunluğu). Geçersiz → 400.
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: { message: "Geçersiz istek parametreleri" } });
    }
    const q = parsed.data;

    // Kimlik: query/body/header'dan ASLA; yalnız server-side session.
    const session = request.session as { customerId?: number; sessionId?: string } | undefined;
    const customerId = session?.customerId;
    // Anonim kimlik = opaque, server-üretimi session id (istemci forge edemez).
    const sessionId = session?.sessionId ?? "anon";
    const stableId = customerId != null ? `c:${customerId}` : `s:${sessionId}`;
    const variant = runtime.experiment.variant(EXPERIMENT_ID, stableId);

    // Rollout kapısı: global flag + müşteri allowlist + yüzdelik + anonim flag.
    // Cohort dışındaki kullanıcı v1 ALMAZ — boş fallback döner, web mevcut
    // (legacy) /discover'a düşer. Böylece v1 yalnız seçili kohortta çalışır.
    const flags = parseDiscoverFlags(process.env);
    if (!isEligibleForDiscoverV1({ customerId, stableId }, flags)) {
      reply.header("Cache-Control", "private, no-store");
      return reply.send({
        requestId: "not-in-cohort",
        algorithmVersion: ALGORITHM_VERSION,
        sections: [],
        cursor: null,
        fallbackUsed: true,
        cacheable: false,
        eligible: false,
        experimentId: EXPERIMENT_ID,
        treatment: "control",
      });
    }

    // Consent: Açık Rıza Metni'nde onay verilmiş mi (customers.analyticsConsentAt,
    // bkz. auth.schemas.ts registerSchema.analyticsConsent) - runtime.consent
    // port'u üzerinden okunur (route handler'ın DB'ye doğrudan bağlanmaması
    // için, bkz. discover.repository.ts productionConsentAdapter).
    const analyticsConsent = await runtime.consent.hasAnalyticsConsent(customerId);
    const req: DiscoverRequest = {
      customerId,
      sessionId,
      surface: q.surface as DiscoverSurface,
      limit: q.limit,
      cursor: q.cursor ?? null,
      consent: { personalization: customerId != null, analytics: analyticsConsent },
    };

    try {
      const res = await runDiscoverV1(req, runtime);
      reply.headers(cacheHeadersFor(res));
      // Public yanıtta iç scoring ağırlıkları / profil vektörü / Redis key'leri
      // BULUNMAZ (DiscoverResponse yapısı bunları içermez — leak by construction).
      return reply.send({ ...res, eligible: true, experimentId: EXPERIMENT_ID, treatment: variant });
    } catch (err) {
      // Kaynakların tümü başarısız olsa bile ana sayfa çökmez — güvenli boş yanıt.
      request.log.warn({ err }, "v1 discover akışı alınamadı");
      reply.header("Cache-Control", "private, no-store");
      return reply.send({
        requestId: "unavailable",
        algorithmVersion: ALGORITHM_VERSION,
        sections: [],
        cursor: null,
        fallbackUsed: true,
        cacheable: false,
        experimentId: EXPERIMENT_ID,
        treatment: variant,
      });
    }
  });
};

export default discoverV1Routes;
