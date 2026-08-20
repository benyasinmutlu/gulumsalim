import { describe, expect, it } from "vitest";
import { buildProfileFromInteractions, expandSizePrefs, FAVORITE_WEIGHT, PURCHASE_WEIGHT, type InteractionRow } from "./profile-builder";

function row(over: Partial<InteractionRow> = {}): InteractionRow {
  return { productId: 1, vendorId: 10, categoryId: 100, brand: "Marka", price: 200, weight: FAVORITE_WEIGHT, createdAt: 1000, ...over };
}

describe("buildProfileFromInteractions", () => {
  it("boş girdi → nötr profil", () => {
    const p = buildProfileFromInteractions([]);
    expect(p.topCategoryIds).toEqual([]);
    expect(p.categoryWeights.size).toBe(0);
    expect(p.priceMin).toBe(0);
    expect(p.priceMax).toBe(0);
    expect(p.knownBrands.size).toBe(0);
  });

  it("kategori ağırlıkları toplanır (ham)", () => {
    const p = buildProfileFromInteractions([
      row({ categoryId: 100, weight: 2 }),
      row({ categoryId: 100, weight: 3 }),
      row({ categoryId: 200, weight: 1 }),
    ]);
    expect(p.categoryWeights.get(100)).toBe(5);
    expect(p.categoryWeights.get(200)).toBe(1);
  });

  it("satın alma favoriden ağır basar (topCategory sırası)", () => {
    const p = buildProfileFromInteractions([
      row({ categoryId: 100, weight: FAVORITE_WEIGHT }), // 2
      row({ categoryId: 200, weight: PURCHASE_WEIGHT }), // 3
    ]);
    expect(p.topCategoryIds[0]).toBe(200);
  });

  it("marka ağırlıkları + knownBrands; null marka sayılmaz", () => {
    const p = buildProfileFromInteractions([
      row({ brand: "Mavi", weight: 2 }),
      row({ brand: "Mavi", weight: 3 }),
      row({ brand: null, weight: 5 }),
    ]);
    expect(p.brandWeights.get("Mavi")).toBe(5);
    expect(p.knownBrands.has("Mavi")).toBe(true);
    expect(p.brandWeights.has("")).toBe(false);
  });

  it("vendorQuality 0..1'e normalize (max=1)", () => {
    const p = buildProfileFromInteractions([
      row({ vendorId: 1, weight: 4 }),
      row({ vendorId: 2, weight: 1 }),
    ]);
    expect(p.vendorQuality.get(1)).toBe(1);
    expect(p.vendorQuality.get(2)).toBeCloseTo(0.25, 5);
  });

  it("fiyat bandı: uçlar budanır (aykırı değer bandı bozmaz)", () => {
    const prices = [100, 100, 110, 120, 130, 140, 150, 160, 170, 5000];
    const p = buildProfileFromInteractions(prices.map((price, i) => row({ price, productId: i })));
    expect(p.priceMin).toBeGreaterThanOrEqual(100);
    expect(p.priceMax).toBeLessThan(5000); // aykırı 5000 p90 dışında kalır
  });

  it("recentProductIds createdAt'e göre yeni→eski", () => {
    const p = buildProfileFromInteractions([
      row({ productId: 1, createdAt: 100 }),
      row({ productId: 2, createdAt: 300 }),
      row({ productId: 3, createdAt: 200 }),
    ]);
    expect(p.recentProductIds).toEqual([2, 3, 1]);
  });

  it("colorWeights + negatif/gizli setleri bu fazda boş", () => {
    const p = buildProfileFromInteractions([row()]);
    expect(p.colorWeights.size).toBe(0);
    expect(p.hiddenProductIds.size).toBe(0);
    expect(p.notInterestedCategoryIds.size).toBe(0);
  });

  it("tek fiyat noktası → min=max", () => {
    const p = buildProfileFromInteractions([row({ price: 250 })]);
    expect(p.priceMin).toBe(250);
    expect(p.priceMax).toBe(250);
  });
});

describe("expandSizePrefs (sizeFit için beden+komşu seti)", () => {
  it("null/boş → []", () => {
    expect(expandSizePrefs(null)).toEqual([]);
    expect(expandSizePrefs({})).toEqual([]);
  });

  it("kadın beden M → küçük harf s,m,l komşuları", () => {
    const out = expandSizePrefs({ kadinBeden: ["M"] });
    expect(out).toContain("m");
    expect(out).toContain("s");
    expect(out).toContain("l");
  });

  it("ayakkabı 38 → 37,38,39 (±1)", () => {
    const out = expandSizePrefs({ ayakkabiNo: [38] });
    expect(out).toEqual(expect.arrayContaining(["37", "38", "39"]));
  });

  it("çoklu tip birleşir + tekilleşir", () => {
    const out = expandSizePrefs({ kadinBeden: ["S"], ayakkabiNo: [40] });
    // S komşuları xs,s,m + ayakkabı 39,40,41
    expect(new Set(out).size).toBe(out.length); // tekil
    expect(out).toContain("s");
    expect(out).toContain("40");
  });
});
