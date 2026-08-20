import { describe, expect, it } from "vitest";
import { enrichProduct } from "../pipeline";
import { ruleProvider } from "../providers/rule-provider";
import { createAiProvider } from "../providers/ai-provider";
import type { EnrichmentContext, EnrichmentProvider } from "../providers/provider";
import type { CategoryResolver, NormalizedProduct } from "../../types";

// Test yardımcıları
function makeProduct(over: Partial<Record<"name" | "description" | "brand", string>> & { categoryId?: number; sizes?: string[] } = {}): NormalizedProduct {
  const fv = <T>(value: T | null) => ({ value, source: "input" as const, confidence: value == null ? 0 : 1 });
  return {
    name: fv(over.name ?? "Çiçekli Yazlık Elbise"),
    basePrice: fv("299.90"),
    compareAtPrice: fv(null),
    categoryId: fv<number>(over.categoryId ?? null),
    description: fv(over.description ?? null),
    brand: fv(over.brand ?? null),
    stock: fv(5),
    sizes: over.sizes ?? ["S", "M", "L"],
    barcode: fv(null),
    fingerprint: "x",
    issues: [],
  };
}
const resolveCategory: CategoryResolver = async (v) => (v === "elbise" ? 42 : null);
const ctx: EnrichmentContext = { vendorId: 1, resolveCategory };

describe("ruleProvider", () => {
  it("başlıktan kategori önerir (elbise -> id)", async () => {
    const r = await ruleProvider.suggestCategory!(makeProduct(), ctx);
    expect(r?.value).toBe(42);
    expect(r?.source).toBe("rule");
  });
  it("kategori zaten varsa öneri yapmaz", async () => {
    expect(await ruleProvider.suggestCategory!(makeProduct({ categoryId: 7 }), ctx)).toBeNull();
  });
  it("başlıktan nitelik (renk/desen) çıkarır", async () => {
    const attrs = await ruleProvider.extractAttributes!(makeProduct({ name: "Kırmızı Çiçekli Elbise" }), ctx);
    expect(attrs.renk).toBe("kırmızı");
    expect(attrs.desen).toBe("çiçekli");
  });
  it("açıklama yoksa şablon üretir", async () => {
    const d = await ruleProvider.generateDescription!(makeProduct({ brand: "Zara" }), ctx);
    expect(d?.value).toContain("Zara");
    expect(d?.source).toBe("rule");
  });
});

describe("aiProvider (key yok -> devre dışı)", () => {
  it("isEnabled false", () => {
    expect(createAiProvider().isEnabled()).toBe(false);
  });
});

describe("enrichProduct cascade", () => {
  it("AI kapalıyken RULE'a düşer (kategori + nitelik önerir)", async () => {
    const r = await enrichProduct(makeProduct({ name: "Kırmızı Elbise" }), ctx);
    expect(r.category?.value).toBe(42);
    expect(r.sources.category).toBe("rule");
    expect(r.attributes?.renk).toBe("kırmızı");
    expect(r.sources.attributes).toBe("rule");
  });

  it("AI başarılı olursa RULE'u ezer (öncelik)", async () => {
    const fakeAi: EnrichmentProvider = {
      name: "ai",
      priority: 0,
      isEnabled: () => true,
      async generateDescription() {
        return { value: "AI açıklaması", source: "ai", confidence: 0.9 };
      },
    };
    const r = await enrichProduct(makeProduct(), ctx, { needs: ["description"], providers: [fakeAi, ruleProvider] });
    expect(r.description?.value).toBe("AI açıklaması");
    expect(r.sources.description).toBe("ai");
  });

  it("AI patlarsa RULE'a düşer (reliability)", async () => {
    const brokenAi: EnrichmentProvider = {
      name: "ai",
      priority: 0,
      isEnabled: () => true,
      async generateDescription() {
        throw new Error("AI down");
      },
    };
    const r = await enrichProduct(makeProduct({ brand: "Mango" }), ctx, { needs: ["description"], providers: [brokenAi, ruleProvider] });
    expect(r.sources.description).toBe("rule");
    expect(r.description?.value).toContain("Mango");
  });

  it("AI timeout olursa RULE'a düşer", async () => {
    const slowAi: EnrichmentProvider = {
      name: "ai",
      priority: 0,
      isEnabled: () => true,
      async generateDescription() {
        await new Promise((res) => setTimeout(res, 50));
        return { value: "geç", source: "ai", confidence: 0.9 };
      },
    };
    const r = await enrichProduct(makeProduct({ brand: "X" }), ctx, { needs: ["description"], providers: [slowAi, ruleProvider], timeoutMs: 10 });
    expect(r.sources.description).toBe("rule");
  });

  it("hiçbir katman sonuç vermezse boş döner, çökmez", async () => {
    const r = await enrichProduct(makeProduct({ name: "Zzz", categoryId: 9, description: "var" }), ctx, { needs: ["category", "description"] });
    expect(r.category).toBeUndefined();
    expect(r.description).toBeUndefined();
    expect(r.sources).toEqual({});
  });
});
