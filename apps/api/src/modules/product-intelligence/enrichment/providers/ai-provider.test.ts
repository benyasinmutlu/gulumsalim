import { describe, expect, it, vi } from "vitest";
import type { NormalizedProduct } from "../../types";
import { createAiProvider } from "./ai-provider";
import type { LlmClient } from "./llm-client";

function product(): NormalizedProduct {
  const field = <T>(value: T | null) => ({ value, source: "input" as const, confidence: value == null ? 0 : 1 });
  return {
    name: field("Kırmızı Çiçekli Elbise"),
    basePrice: field("499.90"),
    compareAtPrice: field<string>(null),
    categoryId: field<number>(null),
    description: field<string>(null),
    brand: field("Örnek"),
    stock: field(1),
    sizes: ["M"],
    barcode: field<string>(null),
    fingerprint: "test",
    issues: [],
  };
}

describe("createAiProvider", () => {
  it("reuses one structured model call across all enrichment needs", async () => {
    const completeJson = vi.fn(async () => ({
      suggestedTitle: "Örnek Kırmızı Çiçekli Elbise",
      categoryCandidate: "Elbise",
      description: "Kırmızı çiçek desenli elbise.",
      color: "kırmızı",
      material: "",
      pattern: "çiçekli",
      missingInformation: [],
      warnings: [],
    }));
    const client = {
      configured: () => true,
      provider: () => "openai" as const,
      complete: vi.fn(),
      completeJson: completeJson as LlmClient["completeJson"],
    } satisfies LlmClient;
    const provider = createAiProvider(client);
    const input = product();
    const context = { vendorId: 1, resolveCategory: vi.fn(async (candidate: string) => candidate === "Elbise" ? 42 : null) };

    await expect(provider.suggestCategory!(input, context)).resolves.toMatchObject({ value: 42, source: "ai" });
    await expect(provider.generateDescription!(input, context)).resolves.toMatchObject({ source: "ai" });
    await expect(provider.extractAttributes!(input, context)).resolves.toEqual({ renk: "kırmızı", desen: "çiçekli" });
    expect(completeJson).toHaveBeenCalledTimes(1);
  });

  it("guides an individual second-hand seller without inventing facts", async () => {
    const completeJson = vi.fn(async () => ({
      suggestedTitle: "Örnek Kırmızı Çiçekli Elbise",
      categoryCandidate: "Elbise",
      description: "Kırmızı çiçek desenli elbise.",
      color: "kırmızı",
      material: "",
      pattern: "çiçekli",
      missingInformation: ["Kusuru var mı?"],
      warnings: [],
    }));
    const client = {
      configured: () => true,
      provider: () => "openrouter" as const,
      complete: vi.fn(),
      completeJson: completeJson as LlmClient["completeJson"],
    } satisfies LlmClient;
    const provider = createAiProvider(client);

    await provider.generateDescription!(product(), {
      vendorId: 2,
      sellerType: "individual",
      facts: { condition: "Az kullanıldı", defects: "Sağ manşette küçük iz" },
      resolveCategory: vi.fn(async () => 42),
    });

    expect(completeJson).toHaveBeenCalledWith(expect.objectContaining({
      system: expect.stringMatching(/ikinci el.*kusur.*uydurma/is),
      prompt: expect.stringMatching(/condition: Az kullanıldı.*defects: Sağ manşette küçük iz/is),
    }));
  });

  it("rejects malformed or oversized model output before it reaches the seller", async () => {
    const completeJson = vi.fn(async () => ({
      suggestedTitle: "x".repeat(121),
      categoryCandidate: "Elbise",
      description: "Açıklama",
      color: "",
      material: "",
      pattern: "",
      missingInformation: [],
      warnings: [],
    }));
    const client = {
      configured: () => true,
      provider: () => "openrouter" as const,
      complete: vi.fn(),
      completeJson: completeJson as LlmClient["completeJson"],
    } satisfies LlmClient;
    const provider = createAiProvider(client);

    await expect(provider.generateDescription!(product(), {
      vendorId: 3,
      sellerType: "business",
      resolveCategory: vi.fn(async () => 42),
    })).rejects.toThrow();
  });
});
