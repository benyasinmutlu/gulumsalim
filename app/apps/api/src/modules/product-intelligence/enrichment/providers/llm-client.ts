// Provider-agnostik LLM köprüsü. Sunucu-taraf AI için env'den okur:
//   AI_PROVIDER = "anthropic" | "openai" | "gemini"
//   AI_API_KEY  = <gizli>
// Anahtar YOKSA configured()=false -> ai-provider devre dışı, sistem rule/ml
// ile tam çalışır. Anahtar gelince tek env ile açılır (kod değişmeden).
//
// NOT: Gerçek HTTP çağrı gövdeleri Faz 3'te (key gelince) doldurulur. Şimdilik
// köprü sadece "yapılandırıldı mı" durumunu ve çağrı iskeletini sağlar.

export type AiProviderName = "anthropic" | "openai" | "gemini";

export interface LlmClient {
  configured(): boolean;
  provider(): AiProviderName | null;
  // Tek atımlık metin üretimi (system + user prompt). Devre dışıysa hata verir.
  complete(input: { system?: string; prompt: string; maxTokens?: number }): Promise<string>;
}

class NotConfiguredError extends Error {
  constructor() {
    super("AI sağlayıcı yapılandırılmadı (AI_PROVIDER + AI_API_KEY eksik).");
    this.name = "NotConfiguredError";
  }
}

function readProvider(): AiProviderName | null {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "anthropic" || raw === "openai" || raw === "gemini") return raw;
  return null;
}

export function createLlmClient(): LlmClient {
  const provider = readProvider();
  const apiKey = (process.env.AI_API_KEY ?? "").trim();
  const isConfigured = provider != null && apiKey.length > 0;

  return {
    configured: () => isConfigured,
    provider: () => (isConfigured ? provider : null),
    async complete() {
      if (!isConfigured) throw new NotConfiguredError();
      // TODO(Faz 3): sağlayıcıya göre gerçek HTTP çağrısı (anthropic/openai/gemini).
      throw new NotConfiguredError();
    },
  };
}
