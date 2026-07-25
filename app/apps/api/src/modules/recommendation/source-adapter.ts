// =============================================================================
// Recommendation Source Adapter (FAZ 5) — repository/adapter pattern
// =============================================================================
// Öneri kaynağını arayüzün ardına gizler: bugün Go discovery servisi, yarın
// yerel v1 ranking veya bir ML servisi. Çağıran (route/service) somut kaynağı
// değil bu arayüzü bilir → kaynak değişimi ve test (mock) kolaylaşır.

export interface RecommendationContext {
  customerId?: number;
  sessionId: string;
  limit: number;
}

export interface RecommendationFeed {
  productIds: number[];
  strategy: string;
  source: string;
}

export interface RecommendationSource {
  readonly name: string;
  getFeed(ctx: RecommendationContext): Promise<RecommendationFeed>;
}

// Dayanıklılık: primary hata verir veya boş dönerse (discovery down, cold-start)
// fallback'e geç. Böylece kullanıcı asla boş akış görmez (graceful degradation).
export function withFallback(
  primary: RecommendationSource,
  fallback: RecommendationSource,
): RecommendationSource {
  return {
    name: `${primary.name}->${fallback.name}`,
    async getFeed(ctx: RecommendationContext): Promise<RecommendationFeed> {
      try {
        const feed = await primary.getFeed(ctx);
        if (feed.productIds.length > 0) return feed;
      } catch {
        // sessizce fallback'e düş — çağıranın akışı bozulmaz
      }
      return fallback.getFeed(ctx);
    },
  };
}

// Sabit/deterministik bir fallback kaynağı (test ve cold-start emniyeti için).
// Gerçek fallback, en yeni aktif ürünler gibi bir sorgu adapter'ı olur.
export function staticSource(name: string, productIds: number[], strategy = "fallback"): RecommendationSource {
  return {
    name,
    async getFeed(ctx: RecommendationContext): Promise<RecommendationFeed> {
      return { productIds: productIds.slice(0, ctx.limit), strategy, source: name };
    },
  };
}
