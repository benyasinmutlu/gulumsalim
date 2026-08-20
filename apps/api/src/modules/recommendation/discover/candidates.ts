import type { Candidate, CandidateSourceName, ReasonCode } from "./contract";

// =============================================================================
// Candidate Sources (FAZ 1.2) — retrieval, ranking'den AYRI (X: candidate
// generation vs heavy ranker). Her kaynak standart arayüz üretir; kaynaklar
// DB'den decouple (port) → deterministik test edilebilir.
// =============================================================================

// Katalog verisi kaynağı (DB adapter'ı prod'da; testte in-memory).
export interface CatalogProduct {
  productId: number;
  vendorId: number;
  categoryId: number;
  brand: string;
  colorFamily: string;
  price: number;
  inStock: boolean;
  status: "active" | "draft" | "pending" | "inactive" | "rejected";
  createdAt: number;
  popularity: number; // 0..1, conversion-adjusted (kaynak sağlar)
  // "Bedenime uygun" sinyali (sizeFit) için: stoğu >0 olan varyant bedenleri.
  // Opsiyonel — beden kavramı olmayan ürün/eski fixture'larda boş sayılır.
  inStockSizes?: string[];
}

export interface CatalogPort {
  productsByCategories(categoryIds: number[], limit: number): Promise<CatalogProduct[]>;
  trending(limit: number): Promise<CatalogProduct[]>;
  newArrivals(limit: number): Promise<CatalogProduct[]>;
  byIds(ids: number[]): Promise<CatalogProduct[]>;
}

// Toplulaştırılmış collaborative sinyal (co-view/co-cart/co-purchase). Minimum
// support ve tek-kullanıcı gizliliği IMPLEMENTASYONDA zorlanır (bkz. threat model).
export interface CollaborativePort {
  alsoInteracted(seedProductIds: number[], limit: number): Promise<{ productId: number; vendorId: number; score: number }[]>;
}

export interface CandidateContext {
  customerId?: number;
  sessionId: string;
  limit: number;
  topCategoryIds: number[];
  recentProductIds: number[];
  knownBrands: Set<string>; // exploration için "bilinen"i dışla
}

export interface CandidateSource {
  readonly name: CandidateSourceName;
  generate(ctx: CandidateContext): Promise<Candidate[]>;
}

const now = () => Date.now();

function toCandidates(
  products: { productId: number; vendorId: number }[],
  source: CandidateSourceName,
  reason: ReasonCode,
  version: string,
): Candidate[] {
  const n = Math.max(1, products.length);
  return products.map((p, i) => ({
    productId: p.productId,
    vendorId: p.vendorId,
    source,
    rawScore: 1 - i / n, // kaynak-yerel sıra → 0..1
    reason,
    version,
    generatedAt: now(),
  }));
}

// A. Personal history — kullanıcının ilgi kategorileri (in-network benzeri).
export function personalHistorySource(catalog: CatalogPort): CandidateSource {
  return {
    name: "personal_history",
    async generate(ctx) {
      if (ctx.topCategoryIds.length === 0) return []; // cold-start → boş
      const products = await catalog.productsByCategories(ctx.topCategoryIds, ctx.limit * 2);
      return toCandidates(products, "personal_history", "because_you_viewed", "phs-1");
    },
  };
}

// B. Collaborative — "bunu görüntüleyenler şunları da" (social proof karşılığı).
export function collaborativeSource(collab: CollaborativePort): CandidateSource {
  return {
    name: "collaborative",
    async generate(ctx) {
      if (ctx.recentProductIds.length === 0) return [];
      const rows = await collab.alsoInteracted(ctx.recentProductIds, ctx.limit * 2);
      return rows.map((r) => ({
        productId: r.productId,
        vendorId: r.vendorId,
        source: "collaborative" as const,
        rawScore: Math.max(0, Math.min(1, r.score)),
        reason: "people_also_viewed" as const,
        version: "collab-1",
        generatedAt: now(),
      }));
    },
  };
}

// C. Trending — zaman pencereli, conversion-adjusted popülerlik.
export function trendingSource(catalog: CatalogPort): CandidateSource {
  return {
    name: "trending",
    async generate(ctx) {
      const products = await catalog.trending(ctx.limit * 2);
      return toCandidates(products, "trending", "trending_now", "trend-1");
    },
  };
}

// D. Exploration — yeni ürün + kullanıcının BİLMEDİĞİ marka (out-of-network).
export function explorationSource(catalog: CatalogPort): CandidateSource {
  return {
    name: "exploration",
    async generate(ctx) {
      const products = await catalog.newArrivals(ctx.limit * 2);
      const fresh = products.filter((p) => !ctx.knownBrands.has(p.brand));
      const pool = (fresh.length > 0 ? fresh : products).map((p) => ({ productId: p.productId, vendorId: p.vendorId }));
      return toCandidates(pool, "exploration", "discover_new_brand", "explore-1");
    },
  };
}

// E. Popüler fallback — her koşulda dolu bir havuz garanti eder (deterministik).
export function popularFallbackSource(catalog: CatalogPort): CandidateSource {
  return {
    name: "popular_fallback",
    async generate(ctx) {
      const products = await catalog.trending(ctx.limit * 2);
      return toCandidates(products, "popular_fallback", "popular", "pop-1");
    },
  };
}

// Dedup: aynı productId birden çok kaynaktan gelebilir → en yüksek rawScore'u
// tut, eşitlikte kaynak önceliğine göre (personal > collaborative > ...).
const SOURCE_PRIORITY: Record<CandidateSourceName, number> = {
  personal_history: 5,
  collaborative: 4,
  trending: 3,
  exploration: 2,
  popular_fallback: 1,
};

export function dedupCandidates(candidates: Candidate[]): Candidate[] {
  const best = new Map<number, Candidate>();
  for (const c of candidates) {
    const cur = best.get(c.productId);
    if (
      !cur ||
      c.rawScore > cur.rawScore ||
      (c.rawScore === cur.rawScore && SOURCE_PRIORITY[c.source] > SOURCE_PRIORITY[cur.source])
    ) {
      best.set(c.productId, c);
    }
  }
  // Deterministik sıra: rawScore DESC, eşitlikte productId DESC.
  return [...best.values()].sort((a, b) => (b.rawScore !== a.rawScore ? b.rawScore - a.rawScore : b.productId - a.productId));
}

// gatherCandidates: kaynakları PARALEL çalıştırır, biri hata verse/boş dönse
// diğerleri devam eder (graceful partial — X: source başına izolasyon). Tüm
// kaynaklar boşsa fallback devreye girer. Prod'da her kaynak timeout ile
// sarılır; burada allSettled izolasyon sağlar.
export interface GatherResult {
  candidates: Candidate[];
  perSourceCounts: Record<string, number>;
  fallbackUsed: boolean;
}

export async function gatherCandidates(
  sources: CandidateSource[],
  fallback: CandidateSource,
  ctx: CandidateContext,
): Promise<GatherResult> {
  const settled = await Promise.allSettled(sources.map((s) => s.generate(ctx)));
  const collected: Candidate[] = [];
  const perSourceCounts: Record<string, number> = {};
  settled.forEach((res, i) => {
    const name = sources[i]!.name;
    if (res.status === "fulfilled") {
      perSourceCounts[name] = res.value.length;
      collected.push(...res.value);
    } else {
      perSourceCounts[name] = 0; // kaynak hatası izole edildi
    }
  });

  let fallbackUsed = false;
  if (collected.length === 0) {
    fallbackUsed = true;
    try {
      const fb = await fallback.generate(ctx);
      perSourceCounts[fallback.name] = fb.length;
      collected.push(...fb);
    } catch {
      perSourceCounts[fallback.name] = 0;
    }
  }

  return { candidates: dedupCandidates(collected), perSourceCounts, fallbackUsed };
}
