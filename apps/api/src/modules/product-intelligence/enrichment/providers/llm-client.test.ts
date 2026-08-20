import { describe, expect, it, vi } from "vitest";
import { AiNotConfiguredError, createLlmClient } from "./llm-client";

describe("createLlmClient", () => {
  it("stays disabled without a supported provider and key", async () => {
    const client = createLlmClient({ provider: "", apiKey: "" });
    expect(client.configured()).toBe(false);
    expect(client.provider()).toBeNull();
    await expect(client.complete({ prompt: "test" })).rejects.toBeInstanceOf(AiNotConfiguredError);
  });

  it("uses the Responses API with a strict JSON schema", async () => {
    const create = vi.fn(async () => ({ output_text: '{"ok":true}' }));
    const client = createLlmClient({
      provider: "openai",
      apiKey: "test-key",
      model: "test-model",
      client: { responses: { create } } as never,
    });

    await expect(client.completeJson<{ ok: boolean }>({
      name: "result",
      schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
      prompt: "test",
    })).resolves.toEqual({ ok: true });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: "test-model",
      store: false,
      text: { format: expect.objectContaining({ type: "json_schema", name: "result", strict: true }) },
    }));
  });

  it("uses OpenRouter structured output with privacy and capability guards", async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const client = createLlmClient({
      provider: "openrouter",
      apiKey: "test-key",
      model: "qwen/test-model",
      fetchImpl,
    });

    await expect(client.completeJson<{ ok: boolean }>({
      name: "result",
      schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
      system: "grounded",
      prompt: "test",
    })).resolves.toEqual({ ok: true });

    expect(client.provider()).toBe("openrouter");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "qwen/test-model",
      response_format: { type: "json_schema", json_schema: { name: "result", strict: true } },
      provider: {
        allow_fallbacks: true,
        require_parameters: true,
        data_collection: "deny",
        sort: "price",
        max_price: { prompt: 0.2, completion: 1 },
      },
    });
  });

  it("rejects an empty model response", async () => {
    const client = createLlmClient({
      provider: "openai",
      apiKey: "test-key",
      client: { responses: { create: vi.fn(async () => ({ output_text: "" })) } } as never,
    });
    await expect(client.complete({ prompt: "test" })).rejects.toThrow("boş yanıt");
  });
});
