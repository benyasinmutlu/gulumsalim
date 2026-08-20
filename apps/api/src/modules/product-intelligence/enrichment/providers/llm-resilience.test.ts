import { describe, expect, it, vi } from "vitest";
import { AiTemporarilyUnavailableError, createLlmClient } from "./llm-client";

describe("LLM resilience guards", () => {
  it("opens the circuit after consecutive provider failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("provider down");
    });
    const client = createLlmClient({
      provider: "openrouter",
      apiKey: "test-key",
      fetchImpl,
      circuitFailureThreshold: 2,
      circuitCooldownMs: 60_000,
    });

    await expect(client.complete({ prompt: "one" })).rejects.toThrow("provider down");
    await expect(client.complete({ prompt: "two" })).rejects.toThrow("provider down");
    await expect(client.complete({ prompt: "three" })).rejects.toBeInstanceOf(AiTemporarilyUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("bulkheads concurrent provider calls", async () => {
    let release!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      release = resolve;
    }));
    const client = createLlmClient({
      provider: "openrouter",
      apiKey: "test-key",
      fetchImpl,
      maxConcurrent: 1,
    });

    const first = client.complete({ prompt: "one" });
    await Promise.resolve();
    await expect(client.complete({ prompt: "two" })).rejects.toBeInstanceOf(AiTemporarilyUnavailableError);

    release(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(first).resolves.toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
