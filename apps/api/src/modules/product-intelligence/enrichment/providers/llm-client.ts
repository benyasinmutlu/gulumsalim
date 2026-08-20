import OpenAI from "openai";

export type AiProviderName = "openai" | "openrouter";

interface CompleteJsonInput {
  system?: string;
  prompt: string;
  name: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface LlmClient {
  configured(): boolean;
  provider(): AiProviderName | null;
  complete(input: { system?: string; prompt: string; maxTokens?: number }): Promise<string>;
  completeJson<T>(input: CompleteJsonInput): Promise<T>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI sağlayıcısı yapılandırılmadı");
    this.name = "AiNotConfiguredError";
  }
}

export class AiTemporarilyUnavailableError extends Error {
  constructor(message = "AI servisi gecici olarak kullanilamiyor") {
    super(message);
    this.name = "AiTemporarilyUnavailableError";
  }
}

interface ClientOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
  client?: Pick<OpenAI, "responses">;
  fetchImpl?: typeof fetch;
  maxConcurrent?: number;
  circuitFailureThreshold?: number;
  circuitCooldownMs?: number;
}

function positiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createLlmClient(options: ClientOptions = {}): LlmClient {
  const provider = (options.provider ?? process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (
    options.apiKey ??
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined) ??
    process.env.AI_API_KEY ??
    ""
  ).trim();
  const defaultModel = provider === "openrouter" ? "qwen/qwen3.5-flash-02-23" : "gpt-5.4-nano";
  const model = (options.model ?? process.env.AI_MODEL ?? defaultModel).trim();
  const configured = (provider === "openai" || provider === "openrouter") && apiKey.length > 0 && model.length > 0;
  const openai = configured && provider === "openai"
    ? options.client ?? new OpenAI({ apiKey, timeout: 7_000, maxRetries: 1 })
    : null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxPromptPrice = Number(process.env.AI_MAX_PROMPT_PRICE_PER_M ?? "0.20");
  const maxCompletionPrice = Number(process.env.AI_MAX_COMPLETION_PRICE_PER_M ?? "1.00");
  const maxConcurrent = positiveInteger(options.maxConcurrent ?? Number(process.env.AI_MAX_CONCURRENT_REQUESTS ?? "4"), 4);
  const circuitFailureThreshold = positiveInteger(
    options.circuitFailureThreshold ?? Number(process.env.AI_CIRCUIT_FAILURE_THRESHOLD ?? "5"),
    5,
  );
  const circuitCooldownMs = positiveInteger(
    options.circuitCooldownMs ?? Number(process.env.AI_CIRCUIT_COOLDOWN_MS ?? "30000"),
    30_000,
  );
  let inFlight = 0;
  let consecutiveFailures = 0;
  let circuitOpenUntil = 0;

  async function withResilience<T>(operation: () => Promise<T>): Promise<T> {
    if (circuitOpenUntil > Date.now()) throw new AiTemporarilyUnavailableError();
    if (inFlight >= maxConcurrent) {
      throw new AiTemporarilyUnavailableError("AI servisi yogun; kural tabanli rehbere geciliyor");
    }

    inFlight++;
    try {
      const result = await operation();
      consecutiveFailures = 0;
      circuitOpenUntil = 0;
      return result;
    } catch (error) {
      consecutiveFailures++;
      if (consecutiveFailures >= circuitFailureThreshold) {
        circuitOpenUntil = Date.now() + circuitCooldownMs;
        consecutiveFailures = 0;
      }
      throw error;
    } finally {
      inFlight--;
    }
  }

  async function createOpenRouterResponse(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    format?: Record<string, unknown>;
  }): Promise<string> {
    const jsonSchema = { ...(input.format ?? {}) };
    delete jsonSchema.type;
    const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL ?? "https://gulumsalim.com",
        "X-OpenRouter-Title": "Gulum Salim Product Intelligence",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt },
        ],
        max_tokens: input.maxTokens ?? 400,
        temperature: 0.2,
        ...(input.format
          ? { response_format: { type: "json_schema", json_schema: jsonSchema } }
          : {}),
        provider: {
          allow_fallbacks: true,
          require_parameters: Boolean(input.format),
          data_collection: "deny",
          sort: "price",
          // OpenRouter fiyatları $/1M token cinsinden sınırlar. Model/provider
          // fiyatı beklenmedik biçimde yükselirse pahalı çağrı yapmak yerine
          // güvenli rule fallback'ine düşer.
          max_price: {
            prompt: Number.isFinite(maxPromptPrice) ? maxPromptPrice : 0.20,
            completion: Number.isFinite(maxCompletionPrice) ? maxCompletionPrice : 1.00,
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`OpenRouter isteği başarısız (${response.status})`);
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI boş yanıt döndürdü");
    return text;
  }

  async function createResponseWithoutResilience(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    format?: Record<string, unknown>;
  }): Promise<string> {
    if (!configured) throw new AiNotConfiguredError();
    if (provider === "openrouter") return createOpenRouterResponse(input);
    if (!openai) throw new AiNotConfiguredError();
    const response = await openai.responses.create({
      model,
      input: [
        ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
        { role: "user" as const, content: input.prompt },
      ],
      max_output_tokens: input.maxTokens ?? 400,
      reasoning: { effort: "none" },
      store: false,
      ...(input.format ? { text: { format: input.format as never } } : {}),
    });
    const text = response.output_text?.trim();
    if (!text) throw new Error("AI boş yanıt döndürdü");
    return text;
  }

  async function createResponse(input: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    format?: Record<string, unknown>;
  }): Promise<string> {
    if (!configured) throw new AiNotConfiguredError();
    return withResilience(() => createResponseWithoutResilience(input));
  }

  return {
    configured: () => configured,
    provider: () => configured ? provider as AiProviderName : null,
    complete: (input) => createResponse(input),
    async completeJson<T>(input: CompleteJsonInput) {
      const text = await createResponse({
        ...input,
        format: { type: "json_schema", name: input.name, strict: true, schema: input.schema },
      });
      return JSON.parse(text) as T;
    },
  };
}
