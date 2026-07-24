import { describe, expect, it } from "vitest";
import { colorsHarmonize, ruleBasedEngine, type Garment } from "./contract";

describe("colorsHarmonize", () => {
  it("matches same color and neutrals", () => {
    expect(colorsHarmonize("blue", "blue")).toBe(true);
    expect(colorsHarmonize("red", "black")).toBe(true); // black neutral
    expect(colorsHarmonize("blue", "white")).toBe(true); // complement + neutral
  });
  it("rejects clashing non-neutral colors", () => {
    expect(colorsHarmonize("red", "green")).toBe(false);
  });
});

const seed: Garment = {
  productId: 1,
  vendorId: 10,
  slot: "top",
  colorFamily: "blue",
  season: "summer",
  style: "casual",
  inStock: true,
};

const catalog: Garment[] = [
  { productId: 2, vendorId: 11, slot: "bottom", colorFamily: "white", season: "summer", style: "casual", inStock: true },
  { productId: 3, vendorId: 12, slot: "shoes", colorFamily: "beige", season: "all", style: "casual", inStock: true },
  { productId: 4, vendorId: 13, slot: "bottom", colorFamily: "red", season: "winter", style: "elegant", inStock: true }, // uyumsuz
];

describe("ruleBasedEngine.suggest", () => {
  it("builds an explainable outfit completing complementary slots", () => {
    const out = ruleBasedEngine().suggest(seed, catalog, { limit: 5 });
    expect(out).toHaveLength(1);
    const first = out[0]!;
    expect(first.items).toEqual([1, 2, 3]); // top + bottom + shoes
    expect(first.reasons.length).toBeGreaterThan(0);
    expect(first.reasons.some((r) => r.includes("Renk uyumu"))).toBe(true);
  });

  it("is deterministic", () => {
    const a = ruleBasedEngine().suggest(seed, catalog, { limit: 5 });
    const b = ruleBasedEngine().suggest(seed, catalog, { limit: 5 });
    expect(a).toEqual(b);
  });

  it("returns nothing when a complementary slot cannot be filled", () => {
    const onlyBottom = catalog.filter((g) => g.slot === "bottom");
    expect(ruleBasedEngine().suggest(seed, onlyBottom, { limit: 5 })).toEqual([]);
  });
});
