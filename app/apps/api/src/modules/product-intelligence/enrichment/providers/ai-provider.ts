import type { FieldValue, NormalizedProduct } from "../../types";
import type { EnrichmentContext, EnrichmentProvider } from "./provider";
import { createLlmClient, type LlmClient } from "./llm-client";

// AI (LLM) katmanı. En kaliteli öneriler ama async + maliyetli + opsiyonel.
// isEnabled() = LLM köprüsü yapılandırıldıysa (key var). Key YOKSA pipeline
// bu katmanı atlar; sistem rule/ml ile çalışır. Gerçek üretim Faz 3'te.
export function createAiProvider(client: LlmClient = createLlmClient()): EnrichmentProvider {
  return {
    name: "ai",
    priority: 0, // en önce (en kaliteli)
    isEnabled: () => client.configured(),

    async suggestCategory(): Promise<FieldValue<number> | null> {
      // Kategori önerisi güvenli bir sınıflandırma gerektirir; Faz 3'te prompt
      // + resolveCategory ile bağlanır. Şimdilik devre dışı -> null.
      return null;
    },

    async generateDescription(p: NormalizedProduct, _ctx: EnrichmentContext): Promise<FieldValue<string> | null> {
      if (!client.configured()) return null;
      const name = p.name.value;
      if (!name) return null;
      // Faz 3: gerçek prompt. İskelet:
      const text = await client.complete({
        system: "Sen bir e-ticaret ürün açıklaması yazarısın. Kısa, doğru, abartısız Türkçe açıklama üret.",
        prompt: `Ürün: ${name}\nMarka: ${p.brand.value ?? "-"}\nBedenler: ${p.sizes.join(", ") || "-"}`,
        maxTokens: 220,
      });
      return { value: text, source: "ai", confidence: 0.85 };
    },

    async extractAttributes(): Promise<Record<string, string>> {
      return {};
    },
  };
}
