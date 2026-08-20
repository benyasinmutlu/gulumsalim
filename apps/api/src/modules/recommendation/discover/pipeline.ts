import { DEFAULT_V1_WEIGHTS, scoreCandidate, type CandidateFeatures, type RankingWeights } from "../ranking";
import {
  collaborativeSource,
  explorationSource,
  gatherCandidates,
  personalHistorySource,
  popularFallbackSource,
  trendingSource,
  type CandidateSource,
  type CatalogPort,
  type CatalogProduct,
  type CollaborativePort,
} from "./candidates";
import {
  ALGORITHM_VERSION,
  decodeCursor,
  encodeCursor,
  recommendationId,
  type Candidate,
  type DiscoverItem,
  type DiscoverRequest,
  type DiscoverResponse,
  type DiscoverSection,
  type SectionKey,
} from "./contract";

// =============================================================================
// Personalized Discover Pipeline (FAZ 1) — eligibility → candidates → hydrate
// → score → post-rank → mix. Deterministik ve saf (yan etki port'larda).
// =============================================================================

export interface DiscoverProfile {
  topCategoryIds: number[];
  recentProductIds: number[];
  knownBrands: Set<string>;
  categoryWeights: Map<number, number>;
  brandWeights: Map<string, number>;
  colorWeights: Map<string, number>;
  priceMin: number;
  priceMax: number;
  hiddenProductIds: Set<number>;
  notInterestedCategoryIds: Set<number>;
  vendorQuality: Map<number, number>;
  // Kullanıcının bedenleri + ±1 komşu (küçük harf normalize). sizeFit için.
  // Opsiyonel — beden girmemiş kullanıcıda boş/undefined (sizeFit=0, nötr).
  sizes?: Set<string>;
}

export interface DiscoverDeps {
  catalog: CatalogPort;
  collaborative: CollaborativePort;
  loadProfile(req: DiscoverRequest): Promise<DiscoverProfile>;
  loadSeen(req: DiscoverRequest): Promise<Set<number>>; // yakında gösterilmiş ürünler
  // Mevcut Go discovery servisini (zaten kişiselleştirilmiş) bir aday kaynağı
  // olarak entegre eder — servisi değiştirmeden üstüne v1 katmanı eklenir.
  legacySource?: CandidateSource;
  requestId: string;
  nowMs?: number;
}

// Diversity üst sınırları (X: author/brand diversity). Tek marka/satıcı/kategori
// akışı dolduramaz.
const MAX_PER_VENDOR = 3;
const MAX_PER_BRAND = 3;
const MAX_PER_CATEGORY = 4;
const FORYOU_LIMIT_RATIO = 1.0;

interface ScoredCandidate {
  candidate: Candidate;
  product: CatalogProduct;
  score: number;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function normFromMap<K>(map: Map<K, number>, key: K): number {
  const v = map.get(key) ?? 0;
  let max = 0;
  for (const x of map.values()) if (x > max) max = x;
  return max > 0 ? clamp01(v / max) : 0;
}

function priceFit(price: number, min: number, max: number): number {
  if (max <= 0 || max < min) return 0.5;
  if (price >= min && price <= max) return 1;
  const center = (min + max) / 2;
  const spread = Math.max(1, max - min);
  return clamp01(1 - Math.abs(price - center) / spread);
}

function freshness(createdAt: number, nowMs: number): number {
  const ageDays = (nowMs - createdAt) / 86_400_000;
  return clamp01(1 - ageDays / 90);
}

// sizeFit: ürünün stoktaki bedenlerinden biri kullanıcının bedeninde (±1 komşu
// dahil) mi? Eşleşme → 1 (boost). Kullanıcı bedeni yok / ürünün bedeni yok →
// 0 (nötr, ceza değil — aksesuar gibi bedensiz ürünler düşmez).
function sizeFit(userSizes: Set<string> | undefined, productSizes: string[] | undefined): number {
  if (!userSizes || userSizes.size === 0 || !productSizes || productSizes.length === 0) return 0;
  for (const s of productSizes) if (userSizes.has(s.toLowerCase())) return 1;
  return 0;
}

// Feature hydration (FAZ 1.3): profil + ürün + çapraz sinyaller → ranking feature'ları.
function hydrateFeatures(
  candidate: Candidate,
  product: CatalogProduct,
  profile: DiscoverProfile,
  nowMs: number,
): CandidateFeatures {
  return {
    categoryAffinity: normFromMap(profile.categoryWeights, product.categoryId),
    vendorAffinity: clamp01(profile.vendorQuality.get(product.vendorId) ?? 0),
    brandAffinity: normFromMap(profile.brandWeights, product.brand),
    colorAffinity: normFromMap(profile.colorWeights, product.colorFamily),
    priceFit: priceFit(product.price, profile.priceMin, profile.priceMax),
    recency: freshness(product.createdAt, nowMs),
    popularity: clamp01(product.popularity),
    availability: product.inStock ? 1 : 0,
    sellerQuality: clamp01(profile.vendorQuality.get(product.vendorId) ?? 0.5),
    sizeFit: sizeFit(profile.sizes, product.inStockSizes),
    // Soft negatif: kullanıcı bu kategoriyi "ilgilenmiyorum" işaretlediyse.
    negativeFeedback: profile.notInterestedCategoryIds.has(product.categoryId) ? 1 : 0,
  };
}

// Eligibility filtering (FAZ 1.1): aday havuzundan uygunsuzları çıkar.
function eligible(product: CatalogProduct | undefined, profile: DiscoverProfile, seen: Set<number>): product is CatalogProduct {
  if (!product) return false; // silinmiş/eksik ürün (hydration'da bulunamadı)
  if (product.status !== "active") return false; // yayında değil
  if (!product.inStock) return false; // stokta yok
  if (profile.hiddenProductIds.has(product.productId)) return false; // kullanıcı gizledi
  if (seen.has(product.productId)) return false; // yakında gösterildi (fatigue)
  return true;
}

// Çok-aşamalı skor: retrieval (kaynak rawScore) + personalized ranker harmanı
// (X: light + heavy ranker). Deterministik.
function finalScore(rankerScore: number, rawScore: number): number {
  return 0.7 * rankerScore + 0.3 * clamp01(rawScore);
}

// Diversity + repetition kısıtlı seçim (post-ranking).
function diversifiedPick(scored: ScoredCandidate[], limit: number, used: Set<number>): ScoredCandidate[] {
  const perVendor = new Map<number, number>();
  const perBrand = new Map<string, number>();
  const perCategory = new Map<number, number>();
  const out: ScoredCandidate[] = [];
  for (const s of scored) {
    if (out.length >= limit) break;
    if (used.has(s.candidate.productId)) continue;
    const v = perVendor.get(s.product.vendorId) ?? 0;
    const b = perBrand.get(s.product.brand) ?? 0;
    const c = perCategory.get(s.product.categoryId) ?? 0;
    if (v >= MAX_PER_VENDOR || b >= MAX_PER_BRAND || c >= MAX_PER_CATEGORY) continue;
    perVendor.set(s.product.vendorId, v + 1);
    perBrand.set(s.product.brand, b + 1);
    perCategory.set(s.product.categoryId, c + 1);
    used.add(s.candidate.productId);
    out.push(s);
  }
  return out;
}

function toItem(s: ScoredCandidate, reqId: string): DiscoverItem {
  return {
    productId: s.candidate.productId,
    recommendationId: recommendationId(reqId, s.candidate.productId),
    reasonCode: s.candidate.reason,
    score: s.score,
    source: s.candidate.source,
  };
}

const SECTION_TITLES: Record<SectionKey, string> = {
  for_you: "Senin için",
  trending: "Bu hafta yükselenler",
  discover_new: "Yeni şeyler keşfet",
};

export async function runDiscover(req: DiscoverRequest, deps: DiscoverDeps): Promise<DiscoverResponse> {
  const nowMs = deps.nowMs ?? Date.now();
  const profile = await deps.loadProfile(req);
  const seen = await deps.loadSeen(req);

  const personalized = Boolean(req.customerId) && req.consent.personalization;

  // Kaynak seçimi: kişiselleştirme yoksa (consent yok / anonim) kişisel + collab
  // kaynakları KULLANILMAZ; yalnız trend + keşif (gizlilik + doğru davranış).
  const ctx = {
    customerId: req.customerId,
    sessionId: req.sessionId,
    limit: req.limit,
    topCategoryIds: personalized ? profile.topCategoryIds : [],
    recentProductIds: personalized ? profile.recentProductIds : [],
    knownBrands: profile.knownBrands,
  };
  const sources = personalized
    ? [
        ...(deps.legacySource ? [deps.legacySource] : []),
        personalHistorySource(deps.catalog),
        collaborativeSource(deps.collaborative),
        trendingSource(deps.catalog),
        explorationSource(deps.catalog),
      ]
    : [trendingSource(deps.catalog), explorationSource(deps.catalog)];

  const gathered = await gatherCandidates(sources, popularFallbackSource(deps.catalog), ctx);

  // Hydration: aday ürün detaylarını tek sorguda çek (N+1 yok).
  const products = await deps.catalog.byIds(gathered.candidates.map((c) => c.productId));
  const productMap = new Map(products.map((p) => [p.productId, p]));

  const scored: ScoredCandidate[] = [];
  for (const candidate of gathered.candidates) {
    const product = productMap.get(candidate.productId);
    if (!eligible(product, profile, seen)) continue;
    const features = hydrateFeatures(candidate, product, profile, nowMs);
    const weights: RankingWeights = DEFAULT_V1_WEIGHTS;
    const ranked = scoreCandidate({ productId: candidate.productId, vendorId: candidate.vendorId, features }, weights);
    scored.push({ candidate, product, score: finalScore(ranked.score, candidate.rawScore) });
  }

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : b.candidate.productId - a.candidate.productId));

  // Cursor: offset tabanlı kararlı sayfalama.
  const offset = decodeCursor(req.cursor);
  const window = scored.slice(offset);

  // Feed mixing (FAZ 1.6): en fazla 3 bölüm, bölümler arası TEKRAR YOK.
  const used = new Set<number>();
  // for_you yalnız kişisel sinyalden (personal_history + collaborative). Anonim/
  // consent yok durumunda bu kaynaklar çalışmaz → bölüm boş kalır ve düşer.
  const forYou = diversifiedPick(
    window.filter((s) => s.candidate.source === "personal_history" || s.candidate.source === "collaborative"),
    Math.ceil(req.limit * FORYOU_LIMIT_RATIO),
    used,
  );
  const trending = diversifiedPick(window.filter((s) => s.candidate.source === "trending"), Math.ceil(req.limit / 2), used);
  const discoverNew = diversifiedPick(window.filter((s) => s.candidate.source === "exploration"), Math.ceil(req.limit / 2), used);

  const allSections: DiscoverSection[] = [
    { key: "for_you", title: SECTION_TITLES.for_you, items: forYou.map((s) => toItem(s, deps.requestId)) },
    { key: "trending", title: SECTION_TITLES.trending, items: trending.map((s) => toItem(s, deps.requestId)) },
    { key: "discover_new", title: SECTION_TITLES.discover_new, items: discoverNew.map((s) => toItem(s, deps.requestId)) },
  ];
  const sections = allSections.filter((sec) => sec.items.length > 0);

  const consumed = offset + used.size;
  return {
    requestId: deps.requestId,
    algorithmVersion: ALGORITHM_VERSION,
    sections,
    cursor: used.size > 0 && consumed < scored.length ? encodeCursor(consumed) : null,
    fallbackUsed: gathered.fallbackUsed,
    // Kişiselleştirilmiş yanıt paylaşımlı cache'e girmemeli (cross-user leak).
    cacheable: !personalized,
  };
}
