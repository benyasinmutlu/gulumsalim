import type { RecommendationEventType } from "../analytics/event-contract";

// =============================================================================
// Incremental Customer Profile (FAZ 3) — davranış event'lerinden artımlı,
// decay'li ilgi profili. Saf/immutable; depolama katmanı ayrı (Redis/PG).
// =============================================================================

export interface CustomerProfile {
  categoryWeights: Record<number, number>;
  brandWeights: Record<string, number>;
  colorWeights: Record<string, number>;
  priceSum: number;
  priceCount: number;
  preferredSizes: string[];
  negativeCategoryIds: number[];
  recentProductIds: number[]; // en yeni önde, sınırlı
  lastUpdated: number;
  version: number;
  consentPersonalization: boolean;
  mergedSessions: string[]; // idempotent merge için işlenen anon session'lar
}

export const PROFILE_VERSION = 1;
const RECENT_LIMIT = 50;
const DECAY_FACTOR = 0.99; // her güncellemede hafif sönme

// Event ağırlıkları: satın alma en güçlü, hide/not_interested güçlü negatif.
const POSITIVE_WEIGHT: Partial<Record<RecommendationEventType, number>> = {
  product_view: 0.1,
  dwell_time: 0.15,
  favorite: 0.5,
  add_to_cart: 0.7,
  purchase: 1.0,
  size_selected: 0.2,
  brand_followed: 0.6,
};
const NEGATIVE_TYPES: Partial<Record<RecommendationEventType, number>> = {
  hide: -0.8,
  not_interested: -0.9,
  remove_from_cart: -0.3,
};

export function emptyProfile(consentPersonalization = false): CustomerProfile {
  return {
    categoryWeights: {},
    brandWeights: {},
    colorWeights: {},
    priceSum: 0,
    priceCount: 0,
    preferredSizes: [],
    negativeCategoryIds: [],
    recentProductIds: [],
    lastUpdated: 0,
    version: PROFILE_VERSION,
    consentPersonalization,
    mergedSessions: [],
  };
}

function decay(map: Record<string | number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[k] = v * DECAY_FACTOR;
  return out;
}

function bump(map: Record<string, number>, key: string | number | undefined, delta: number): Record<string, number> {
  if (key === undefined) return map;
  const k = String(key);
  const next = { ...map, [k]: Math.max(0, (map[k] ?? 0) + delta) };
  return next;
}

export interface ProfileEventInput {
  type: RecommendationEventType;
  productId?: number;
  categoryId?: number;
  brand?: string;
  colorFamily?: string;
  price?: number;
  size?: string;
  occurredAt: number;
  dwellMs?: number;
}

// Tek satın alma tüm feed'i KİLİTLEMESİN diye ağırlıklar sınırlı + decay'li.
export function applyEvent(profile: CustomerProfile, e: ProfileEventInput): CustomerProfile {
  const decayed: CustomerProfile = {
    ...profile,
    categoryWeights: decay(profile.categoryWeights),
    brandWeights: decay(profile.brandWeights),
    colorWeights: decay(profile.colorWeights),
    lastUpdated: e.occurredAt,
  };

  const neg = NEGATIVE_TYPES[e.type];
  if (neg !== undefined) {
    const negCats = e.categoryId != null && !decayed.negativeCategoryIds.includes(e.categoryId)
      ? [...decayed.negativeCategoryIds, e.categoryId]
      : decayed.negativeCategoryIds;
    return {
      ...decayed,
      categoryWeights: bump(decayed.categoryWeights, e.categoryId, neg),
      brandWeights: bump(decayed.brandWeights, e.brand, neg),
      negativeCategoryIds: negCats,
    };
  }

  let delta = POSITIVE_WEIGHT[e.type] ?? 0;
  if (e.type === "dwell_time" && e.dwellMs != null) {
    delta = Math.min(0.3, 0.05 + e.dwellMs / 60_000); // süreye bağlı, sınırlı
  }
  if (delta === 0) return decayed;

  const recent = e.productId != null
    ? [e.productId, ...decayed.recentProductIds.filter((id) => id !== e.productId)].slice(0, RECENT_LIMIT)
    : decayed.recentProductIds;
  const sizes = e.size && !decayed.preferredSizes.includes(e.size)
    ? [...decayed.preferredSizes, e.size]
    : decayed.preferredSizes;

  return {
    ...decayed,
    categoryWeights: bump(decayed.categoryWeights, e.categoryId, delta),
    brandWeights: bump(decayed.brandWeights, e.brand, delta),
    colorWeights: bump(decayed.colorWeights, e.colorFamily, delta),
    priceSum: e.price != null ? decayed.priceSum + e.price : decayed.priceSum,
    priceCount: e.price != null ? decayed.priceCount + 1 : decayed.priceCount,
    preferredSizes: sizes,
    recentProductIds: recent,
  };
}

function mergeWeights(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

// Anonymous → logged-in merge (FAZ 3). AGGREGATE merge (event replay değil).
// IDEMPOTENT: aynı anon session iki kez merge edilirse ikinci sefer no-op.
// Consent yoksa kalıcı profile MERGE EDİLMEZ.
export function mergeAnonymousProfile(target: CustomerProfile, anon: CustomerProfile, anonSessionId: string): CustomerProfile {
  if (!target.consentPersonalization) return target; // consent yok → merge yok
  if (target.mergedSessions.includes(anonSessionId)) return target; // idempotent

  return {
    ...target,
    categoryWeights: mergeWeights(target.categoryWeights, anon.categoryWeights),
    brandWeights: mergeWeights(target.brandWeights, anon.brandWeights),
    colorWeights: mergeWeights(target.colorWeights, anon.colorWeights),
    priceSum: target.priceSum + anon.priceSum,
    priceCount: target.priceCount + anon.priceCount,
    preferredSizes: [...new Set([...target.preferredSizes, ...anon.preferredSizes])],
    negativeCategoryIds: [...new Set([...target.negativeCategoryIds, ...anon.negativeCategoryIds])],
    recentProductIds: [...new Set([...anon.recentProductIds, ...target.recentProductIds])].slice(0, RECENT_LIMIT),
    mergedSessions: [...target.mergedSessions, anonSessionId],
    lastUpdated: Math.max(target.lastUpdated, anon.lastUpdated),
  };
}
