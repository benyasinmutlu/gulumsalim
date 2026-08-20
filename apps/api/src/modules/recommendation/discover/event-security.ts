import { deriveDedupKey, recommendationEventTypes, type RecommendationEventType } from "../../analytics/event-contract";

// =============================================================================
// Behavioral Event Security Validation (FAZ 2 / FAZ 8)
// =============================================================================
// Sınırda fail-fast: customerId DAİMA session'dan (body'den değil), purchase
// yalnız güvenilir backend'den, boyut/skew/batch limitleri, consent gating,
// idempotency anahtarı. (bkz. recommendation-privacy-threat-model.md)

export const MAX_EVENT_BATCH = 50;
export const MAX_METADATA_KEYS = 10;
export const MAX_METADATA_VALUE_LEN = 256;
export const TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

// İstemcinin ÜRETEMEYECEĞİ event'ler: satın alma yalnız güvenilir ödeme
// callback'inden (checkout.service) yayınlanır — sahte purchase engeli.
export const CLIENT_FORBIDDEN_TYPES: readonly RecommendationEventType[] = ["purchase"];

export interface RawClientEvent {
  type: string;
  productId?: number;
  vendorId?: number;
  categoryId?: number;
  occurredAt?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  // NOT: istemci customerId gönderse bile OKUNMAZ — daima session'dan alınır.
}

export interface TrustedEventContext {
  sessionCustomerId?: number;
  sessionId: string;
  nowMs: number;
  consentPersonalization: boolean;
}

export interface TrustedEvent {
  type: RecommendationEventType;
  customerId?: number;
  sessionId: string;
  productId?: number;
  vendorId?: number;
  categoryId?: number;
  occurredAt: number;
  source: string;
  dedupKey: string; // idempotency (aynı mantıksal event'in tekrarını yakalar)
  writeProfile: boolean; // consent yoksa kişisel profile YAZILMAZ
}

export type EventValidation = { ok: true; event: TrustedEvent } | { ok: false; reason: string };

function metadataOk(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return true;
  const keys = Object.keys(meta);
  if (keys.length > MAX_METADATA_KEYS) return false;
  for (const k of keys) {
    const v = meta[k];
    const primitive = typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    if (!primitive) return false;
    if (typeof v === "string" && v.length > MAX_METADATA_VALUE_LEN) return false;
  }
  return true;
}

export function validateClientEvent(raw: RawClientEvent, ctx: TrustedEventContext): EventValidation {
  if (!(recommendationEventTypes as readonly string[]).includes(raw.type)) {
    return { ok: false, reason: "unsupported_type" };
  }
  const type = raw.type as RecommendationEventType;

  // İstemci purchase gibi güvenilir-yalnız event'i üretemez.
  if (CLIENT_FORBIDDEN_TYPES.includes(type)) return { ok: false, reason: "server_only_event" };

  // Timestamp skew: gelecek/aşırı geçmiş event reddedilir (yoksa now).
  const occurredAt = raw.occurredAt ?? ctx.nowMs;
  if (Math.abs(occurredAt - ctx.nowMs) > TIMESTAMP_SKEW_MS) return { ok: false, reason: "timestamp_skew" };

  if (!metadataOk(raw.metadata)) return { ok: false, reason: "metadata_too_large" };

  // Kimlik DAİMA session'dan (spoofed customerId yok sayılır).
  const identity = {
    customerId: ctx.sessionCustomerId,
    sessionId: ctx.sessionId,
  };
  const dedupKey = deriveDedupKey({
    type,
    occurredAt,
    identity,
    productId: raw.productId,
    source: raw.source ?? "unknown",
    consent: { personalization: ctx.consentPersonalization, analytics: true },
  });

  return {
    ok: true,
    event: {
      type,
      customerId: ctx.sessionCustomerId,
      sessionId: ctx.sessionId,
      productId: raw.productId,
      vendorId: raw.vendorId,
      categoryId: raw.categoryId,
      occurredAt,
      source: raw.source ?? "unknown",
      dedupKey,
      // Consent yoksa VE giriş yapılmışsa bile kişisel profile yazılmaz.
      writeProfile: ctx.consentPersonalization && ctx.sessionCustomerId != null,
    },
  };
}

export interface BatchValidation {
  accepted: TrustedEvent[];
  rejected: { index: number; reason: string }[];
}

export function validateEventBatch(raws: RawClientEvent[], ctx: TrustedEventContext): BatchValidation {
  const accepted: TrustedEvent[] = [];
  const rejected: { index: number; reason: string }[] = [];
  const seen = new Set<string>(); // batch içi idempotency

  raws.forEach((raw, index) => {
    if (index >= MAX_EVENT_BATCH) {
      rejected.push({ index, reason: "batch_limit" });
      return;
    }
    const res = validateClientEvent(raw, ctx);
    if (!res.ok) {
      rejected.push({ index, reason: res.reason });
      return;
    }
    if (seen.has(res.event.dedupKey)) {
      rejected.push({ index, reason: "duplicate" });
      return;
    }
    seen.add(res.event.dedupKey);
    accepted.push(res.event);
  });

  return { accepted, rejected };
}
