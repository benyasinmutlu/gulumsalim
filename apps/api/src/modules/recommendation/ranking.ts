// =============================================================================
// Explainable Deterministic Ranking v1 (FAZ 5 / Personalization Engine)
// =============================================================================
// ML YOK: açıklanabilir, deterministik ağırlıklı skorlama. Amaç, mevcut Go
// discovery sıralamasının ÜSTÜNE geçilebilir, feature-flag'li ve "neden bu ürün"
// açıklaması üreten bir katman. Saf fonksiyonlar → test edilebilir, yan etkisiz.

export type RankingStrategy = "legacy" | "v1";

// Feature'lar 0..1'e normalize edilmiş gelir (çağıran normalize eder). Eksik
// feature 0 sayılır. negativeFeedback bir CEZA sinyalidir (yüksek = kötü).
export interface CandidateFeatures {
  categoryAffinity?: number;
  vendorAffinity?: number;
  colorAffinity?: number;
  brandAffinity?: number;
  priceFit?: number;
  recency?: number;
  popularity?: number;
  availability?: number; // 0 = stokta yok → filtrelenir
  sellerQuality?: number;
  sizeFit?: number; // kullanıcının bedeninde (±1) + stokta → 1, aksi 0 (BOOST)
  negativeFeedback?: number; // hide/not_interested yoğunluğu (ceza)
}

export interface RankingCandidate {
  productId: number;
  vendorId: number;
  features: CandidateFeatures;
}

export interface FeatureContribution {
  feature: string;
  weight: number;
  value: number;
  contribution: number;
}

export interface RankedItem {
  productId: number;
  vendorId: number;
  score: number;
  strategy: RankingStrategy;
  explanation: FeatureContribution[]; // en yüksek katkılı ilk N feature
}

export interface RankingWeights {
  categoryAffinity: number;
  vendorAffinity: number;
  colorAffinity: number;
  brandAffinity: number;
  priceFit: number;
  recency: number;
  popularity: number;
  sellerQuality: number;
  sizeFit: number;
  negativeFeedback: number; // negatif ağırlık (ceza)
}

// Varsayılan v1 ağırlıkları — açıklanabilir ve elle ayarlanabilir. A/B ile
// değiştirilebilir; toplam pozitif ağırlık ~1.0 civarı tutuldu (sizeFit eklendi,
// moda için güçlü sinyal → diğerleri hafif düşürülerek yeniden dengelendi).
export const DEFAULT_V1_WEIGHTS: RankingWeights = {
  categoryAffinity: 0.25,
  vendorAffinity: 0.12,
  colorAffinity: 0.08,
  brandAffinity: 0.10,
  priceFit: 0.10,
  recency: 0.08,
  popularity: 0.07,
  sellerQuality: 0.05,
  sizeFit: 0.15,
  negativeFeedback: -0.40,
};

const EXPLANATION_TOP_N = 3;
const DEFAULT_MAX_PER_VENDOR = 3;

function clamp01(v: number | undefined): number {
  if (v === undefined || Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Tek adayı skorlar ve feature katkılarını (açıklama) döner. Saf ve deterministik.
export function scoreCandidate(candidate: RankingCandidate, weights: RankingWeights): RankedItem {
  const f = candidate.features;
  const contributions: FeatureContribution[] = [
    ["categoryAffinity", weights.categoryAffinity, clamp01(f.categoryAffinity)],
    ["vendorAffinity", weights.vendorAffinity, clamp01(f.vendorAffinity)],
    ["colorAffinity", weights.colorAffinity, clamp01(f.colorAffinity)],
    ["brandAffinity", weights.brandAffinity, clamp01(f.brandAffinity)],
    ["priceFit", weights.priceFit, clamp01(f.priceFit)],
    ["recency", weights.recency, clamp01(f.recency)],
    ["popularity", weights.popularity, clamp01(f.popularity)],
    ["sellerQuality", weights.sellerQuality, clamp01(f.sellerQuality)],
    ["sizeFit", weights.sizeFit, clamp01(f.sizeFit)],
    ["negativeFeedback", weights.negativeFeedback, clamp01(f.negativeFeedback)],
  ].map(([feature, weight, value]) => ({
    feature: feature as string,
    weight: weight as number,
    value: value as number,
    contribution: (weight as number) * (value as number),
  }));

  const score = contributions.reduce((sum, c) => sum + c.contribution, 0);
  const explanation = [...contributions]
    .filter((c) => c.contribution !== 0)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, EXPLANATION_TOP_N);

  return { productId: candidate.productId, vendorId: candidate.vendorId, score, strategy: "v1", explanation };
}

export interface RankOptions {
  weights?: RankingWeights;
  limit: number;
  maxPerVendor?: number;
}

// v1 sıralaması: stokta olmayanları eler, skorlar, deterministik sıralar
// (skor DESC, eşitlikte productId DESC), satıcı çeşitliliği uygular.
export function rankV1(candidates: RankingCandidate[], opts: RankOptions): RankedItem[] {
  const weights = opts.weights ?? DEFAULT_V1_WEIGHTS;
  const maxPerVendor = opts.maxPerVendor ?? DEFAULT_MAX_PER_VENDOR;

  const scored = candidates
    .filter((c) => clamp01(c.features.availability) > 0)
    .map((c) => scoreCandidate(c, weights))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.productId - a.productId));

  const perVendor = new Map<number, number>();
  const out: RankedItem[] = [];
  for (const item of scored) {
    if (out.length >= opts.limit) break;
    const used = perVendor.get(item.vendorId) ?? 0;
    if (used >= maxPerVendor) continue;
    perVendor.set(item.vendorId, used + 1);
    out.push(item);
  }
  return out;
}

// Feature flag geçişi. "legacy" → Go discovery sırasını koru (passthrough);
// "v1" → yerel açıklanabilir yeniden-sıralama. Bilinmeyen değer güvenli tarafa
// (legacy) düşer — fallback.
export function selectRankingStrategy(flag: string | undefined): RankingStrategy {
  return flag === "v1" ? "v1" : "legacy";
}

// legacy passthrough: discovery'nin döndürdüğü sırayı RankedItem'e sarar
// (skor = konum-temelli azalan), açıklama boş. Böylece çağıran tek tip döner.
export function rankLegacyPassthrough(productIds: number[], vendorByProduct: Map<number, number>): RankedItem[] {
  const n = productIds.length;
  return productIds.map((productId, i) => ({
    productId,
    vendorId: vendorByProduct.get(productId) ?? 0,
    score: n > 0 ? 1 - i / n : 0,
    strategy: "legacy" as const,
    explanation: [],
  }));
}
