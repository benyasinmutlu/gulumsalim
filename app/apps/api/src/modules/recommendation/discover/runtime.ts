import { experimentBucket, type DiscoverRequest, type DiscoverResponse } from "./contract";
import type { CandidateSource, CatalogPort, CollaborativePort } from "./candidates";
import { runDiscover, type DiscoverDeps, type DiscoverProfile } from "./pipeline";

// =============================================================================
// Discover Runtime Adapters (FAZ 4) — port/adapter ayrımı. Saf pipeline'ı
// gerçek veri kaynaklarına bağlar; timeout/fallback orkestrasyonu burada.
// Prod adapter'ları DB/Go servisine bağlanır; testte in-memory.
// =============================================================================

export type ProductCatalogAdapter = CatalogPort;

export interface LegacyRecommendationAdapter {
  // Mevcut Go discovery / legacy API — zaten kişiselleştirilmiş productId listesi.
  personalizedProductIds(customerId: number | undefined, limit: number): Promise<number[]>;
}

export interface CustomerProfileAdapter {
  load(req: DiscoverRequest): Promise<DiscoverProfile>;
}

export interface SeenHistoryAdapter {
  load(req: DiscoverRequest): Promise<Set<number>>;
  record?(req: DiscoverRequest, productIds: number[]): Promise<void>;
}

export interface RecommendationEventAdapter {
  emit?(event: { type: string; recommendationId?: string; productId?: number }): void;
}

export interface ExperimentAdapter {
  variant(experimentId: string, stableId: string): "control" | "treatment";
}

// Açık Rıza Metni onayının (customers.analyticsConsentAt) kaynağı - port/
// adapter ayrımına uyar ki route handler DB'ye doğrudan bağlanmasın (bkz.
// discover.v1.routes.test.ts, gerçek DB bağlantısı olmayan izole testler).
export interface ConsentAdapter {
  hasAnalyticsConsent(customerId: number | undefined): Promise<boolean>;
}

export interface DiscoverRuntime {
  catalog: ProductCatalogAdapter;
  collaborative: CollaborativePort;
  legacy: LegacyRecommendationAdapter;
  profile: CustomerProfileAdapter;
  seen: SeenHistoryAdapter;
  experiment: ExperimentAdapter;
  consent: ConsentAdapter;
  generateRequestId(): string;
  nowMs?: number;
}

// Timeout sarmalayıcı: her dış kaynak bounded olmalı; süre aşımında güvenli
// varsayılana düşer (partial failure → fallback). Prod'da AbortSignal ile
// gerçek iptal; burada yarış-tabanlı sınır yeterli ve deterministik test edilir.
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Mevcut Go discovery feed'ini bir CandidateSource'a çevirir (source=personal_
// history → for_you bölümüne düşer). vendorId hydration'da düzeltilir; kaynak
// hata verirse boş döner (gatherCandidates izole eder).
export function legacyFeedSource(legacy: LegacyRecommendationAdapter, timeoutMs = 300): CandidateSource {
  return {
    name: "personal_history",
    async generate(ctx) {
      const ids = await withTimeout(legacy.personalizedProductIds(ctx.customerId, ctx.limit * 2), timeoutMs, []);
      const n = Math.max(1, ids.length);
      return ids.map((productId, i) => ({
        productId,
        vendorId: 0, // hydration'da product.vendorId kullanılır
        source: "personal_history" as const,
        rawScore: 1 - i / n,
        reason: "because_you_viewed" as const,
        version: "legacy-go-1",
        generatedAt: ctx.limit, // deterministik (Date.now değil)
      }));
    },
  };
}

// Deterministik deney adapter'ı: bucket < 50 → treatment.
export function deterministicExperiment(): ExperimentAdapter {
  return {
    variant(experimentId, stableId) {
      return experimentBucket(experimentId, stableId, 100) < 50 ? "treatment" : "control";
    },
  };
}

// Boş/nötr profil — profil deposu henüz bağlanmadığı için (kişiselleştirme Go
// feed'inden gelir). Persist edilen profil bağlanınca bu adapter değişir.
export function emptyDiscoverProfile(): DiscoverProfile {
  return {
    topCategoryIds: [],
    recentProductIds: [],
    knownBrands: new Set(),
    categoryWeights: new Map(),
    brandWeights: new Map(),
    colorWeights: new Map(),
    priceMin: 0,
    priceMax: 0,
    hiddenProductIds: new Set(),
    notInterestedCategoryIds: new Set(),
    vendorQuality: new Map(),
  };
}

export function inMemoryProfileAdapter(profile: DiscoverProfile = emptyDiscoverProfile()): CustomerProfileAdapter {
  return { load: async () => profile };
}

export function inMemorySeenAdapter(seen: Set<number> = new Set()): SeenHistoryAdapter {
  return { load: async () => seen };
}

// Runtime → pipeline DiscoverDeps.
export function buildDiscoverDeps(runtime: DiscoverRuntime, requestId: string): DiscoverDeps {
  return {
    catalog: runtime.catalog,
    collaborative: runtime.collaborative,
    loadProfile: (req) => runtime.profile.load(req),
    loadSeen: (req) => runtime.seen.load(req),
    legacySource: legacyFeedSource(runtime.legacy),
    requestId,
    nowMs: runtime.nowMs,
  };
}

export async function runDiscoverV1(req: DiscoverRequest, runtime: DiscoverRuntime): Promise<DiscoverResponse> {
  const requestId = runtime.generateRequestId();
  return runDiscover(req, buildDiscoverDeps(runtime, requestId));
}

// Cache güvenliği: kişiselleştirilmiş yanıt paylaşımlı cache'e girmemeli.
export function cacheHeadersFor(res: DiscoverResponse): Record<string, string> {
  if (!res.cacheable) {
    // Authenticated personalized → private, asla shared/CDN cache.
    return { "Cache-Control": "private, no-store", Vary: "Cookie" };
  }
  // Anonim trending fallback → kısa süre paylaşımlı cache güvenli.
  return { "Cache-Control": "public, max-age=60", Vary: "Cookie" };
}
