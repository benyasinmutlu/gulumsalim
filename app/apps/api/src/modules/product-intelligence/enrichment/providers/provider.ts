import type { CategoryResolver, FieldValue, NormalizedProduct } from "../../types";

// Zenginleştirme = ürünü daha satılabilir yapan ÖNERİLER (kategori, açıklama,
// nitelik). Deterministik değil; her öneri güven taşır ve satıcı ezip geçebilir.
// Bir katman (rule/ml/ai) bu arayüzü uygular; pipeline katmanları sırayla dener.

export type EnrichmentNeed = "category" | "description" | "attributes";

export interface EnrichmentContext {
  vendorId: number;
  // Kategori önerisini id'ye çözmek için (DB'ye bağlı; enjekte edilir).
  resolveCategory: CategoryResolver;
}

export interface EnrichmentProvider {
  readonly name: "rule" | "ml" | "ai";
  // Katman öncelik sırası (küçük = önce denenir): ai=0, ml=1, rule=2.
  readonly priority: number;
  isEnabled(): boolean;
  suggestCategory?(p: NormalizedProduct, ctx: EnrichmentContext): Promise<FieldValue<number> | null>;
  generateDescription?(p: NormalizedProduct, ctx: EnrichmentContext): Promise<FieldValue<string> | null>;
  extractAttributes?(p: NormalizedProduct, ctx: EnrichmentContext): Promise<Record<string, string>>;
}

// Pipeline sonucu: her ihtiyaç için öneri + hangi katmandan geldiği.
export interface EnrichmentResult {
  category?: FieldValue<number>;
  description?: FieldValue<string>;
  attributes?: Record<string, string>;
  // Hangi ihtiyacı hangi katman karşıladı (gözlemlenebilirlik + audit).
  sources: Partial<Record<EnrichmentNeed, "rule" | "ml" | "ai">>;
}
