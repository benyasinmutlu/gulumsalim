import { createHash } from "node:crypto";
import { z } from "zod";

// =============================================================================
// Versioned Recommendation Event Contract (FAZ 5 / Personalization Engine v1)
// =============================================================================
// Bu, gelecek kişiselleştirme/keşfet pipeline'ı için ADDITIVE bir sözleşme
// katmanıdır. Mevcut emitBehavioralEvent → Redis stream (view/favorite/cart_add/
// purchase) çalışmaya devam eder; bu katman onu versiyonlu bir zarfla sarar ve
// consent + anonymous-session + idempotency ekler. Go consumer bilinmeyen
// alanları yok saydığından geriye-uyumludur (bkz. docs/architecture/
// personalization-engine.md).

export const RECOMMENDATION_EVENT_SCHEMA_VERSION = 1 as const;

// Tam davranışsal event yelpazesi (roadmap). Mevcut Redis pipeline yalnızca
// ilk dördünü ağırlıklandırır; gerisi v1'de toplanır, ranking'e kademeli girer.
export const recommendationEventTypes = [
  "product_view",
  "search",
  "impression",
  "click",
  "favorite",
  "add_to_cart",
  "remove_from_cart",
  "purchase",
  "hide",
  "not_interested",
  "size_selected",
  "brand_followed",
  "dwell_time",
] as const;
export type RecommendationEventType = (typeof recommendationEventTypes)[number];

// Kişiselleştirme yalnızca açık rıza ile; analytics ayrı sinyal. Gizlilik
// odaklı: rıza yoksa event yalnız anonim/agrege amaçla işlenebilir.
export const consentSchema = z.object({
  personalization: z.boolean(),
  analytics: z.boolean(),
});
export type Consent = z.infer<typeof consentSchema>;

// Kimlik: giriş yapmışsa customerId; her durumda kararlı bir session/anon id.
const identitySchema = z.object({
  customerId: z.number().int().positive().optional(),
  sessionId: z.string().min(1),
  anonymousId: z.string().min(1).optional(),
});

export const recommendationEventInputSchema = z.object({
  type: z.enum(recommendationEventTypes),
  occurredAt: z.number().int().positive(), // epoch ms
  identity: identitySchema,
  productId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  source: z.string().min(1), // surface: "home_discover", "search", "pdp", ...
  correlationId: z.string().min(1).optional(),
  consent: consentSchema,
  // Tipe özgü payload (search query, dwell süresi, seçilen beden ...).
  payload: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type RecommendationEventInput = z.infer<typeof recommendationEventInputSchema>;

export interface RecommendationEvent extends RecommendationEventInput {
  schemaVersion: typeof RECOMMENDATION_EVENT_SCHEMA_VERSION;
  eventId: string;
  dedupKey: string;
}

// Idempotency/deduplication: aynı mantıksal event'in tekrarını (retry, çift
// gönderim) tespit için kararlı alanlardan türetilir. occurredAt saniyeye
// yuvarlanır ki milisaniye jitter'ı aynı eylemi ikiye bölmesin.
export function deriveDedupKey(input: RecommendationEventInput): string {
  const identity =
    input.identity.customerId != null
      ? `c:${input.identity.customerId}`
      : `s:${input.identity.anonymousId ?? input.identity.sessionId}`;
  const bucketSec = Math.floor(input.occurredAt / 1000);
  const parts = [input.type, identity, input.productId ?? "-", input.source, bucketSec];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

// Girdiyi doğrular, schemaVersion/eventId/dedupKey ekleyerek kanonik event üretir.
// Geçersiz girdi ZodError fırlatır (sınırda fail-fast).
export function buildRecommendationEvent(input: unknown): RecommendationEvent {
  const parsed = recommendationEventInputSchema.parse(input);
  return {
    ...parsed,
    schemaVersion: RECOMMENDATION_EVENT_SCHEMA_VERSION,
    eventId: createHash("sha256")
      .update(`${deriveDedupKey(parsed)}|${crypto_randomish(parsed)}`)
      .digest("hex")
      .slice(0, 24),
    dedupKey: deriveDedupKey(parsed),
  };
}

// eventId dedupKey'den farklı olmalı (aynı mantıksal eylem birden çok fiziksel
// event üretebilir); occurredAt tam değerini karıştırarak ayrıştırırız.
function crypto_randomish(input: RecommendationEventInput): string {
  return String(input.occurredAt);
}

// Mevcut Redis behavioral stream'e köprü: yeni sözleşmedeki dört çekirdek tip,
// Go discovery'nin beklediği alan setine indirgenir (geriye-uyum). Diğer tipler
// (impression/hide/dwell_time ...) v1 toplayıcıya gider, bu köprüden geçmez.
const STREAM_TYPE_MAP: Partial<Record<RecommendationEventType, string>> = {
  product_view: "view",
  favorite: "favorite",
  add_to_cart: "cart_add",
  purchase: "purchase",
};

export function toBehavioralStreamFields(event: RecommendationEvent): Record<string, string> | null {
  const mapped = STREAM_TYPE_MAP[event.type];
  if (!mapped) return null; // bu event mevcut affinity pipeline'ına girmez
  // Kişiselleştirme rızası yoksa kişisel affinity'ye yazma (gizlilik).
  if (!event.consent.personalization) return null;
  const fields: Record<string, string> = {
    type: mapped,
    ts: String(event.occurredAt),
  };
  if (event.identity.customerId != null) fields.customerId = String(event.identity.customerId);
  if (event.productId != null) fields.productId = String(event.productId);
  if (event.vendorId != null) fields.vendorId = String(event.vendorId);
  if (event.categoryId != null) fields.categoryId = String(event.categoryId);
  if (event.identity.sessionId) fields.sessionId = event.identity.sessionId;
  return fields;
}
