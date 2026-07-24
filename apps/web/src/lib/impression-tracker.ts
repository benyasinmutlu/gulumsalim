// =============================================================================
// Impression Tracker (FAZ 6) — framework-agnostik, saf abstraction.
// =============================================================================
// Impression YALNIZCA gerçek viewport gözlemi olunca sayılmalı (render ≠
// impression). Bu modül React/Next içermez; IntersectionObserver'ı çağıran
// bağlar ve gerçekten görünür olunca `markVisible` çağırır. Aynı recommendation
// oturum içinde tekrar tekrar loglanmaz; rerender duplicate impression üretmez.

export interface TrackedEvent {
  type: "impression" | "click";
  recommendationId: string;
  productId: number;
}

export type EmitFn = (event: TrackedEvent) => void;

export interface ImpressionTracker {
  // Bir öğe gerçekten görünür olduğunda çağrılır (IntersectionObserver'dan).
  // Aynı recommendationId için yalnız BİR kez impression yayınlar.
  markVisible(recommendationId: string, productId: number): void;
  // Tıklamada çağrılır — recommendationId taşınır (hangi öneri tıklandı).
  markClick(recommendationId: string, productId: number): void;
  // Yeni feed/oturum başında durum sıfırlanır (dedup penceresi).
  reset(): void;
}

export function createImpressionTracker(emit: EmitFn): ImpressionTracker {
  const impressed = new Set<string>();
  return {
    markVisible(recommendationId, productId) {
      if (!recommendationId || impressed.has(recommendationId)) return; // dedup
      impressed.add(recommendationId);
      emit({ type: "impression", recommendationId, productId });
    },
    markClick(recommendationId, productId) {
      if (!recommendationId) return;
      emit({ type: "click", recommendationId, productId });
    },
    reset() {
      impressed.clear();
    },
  };
}
