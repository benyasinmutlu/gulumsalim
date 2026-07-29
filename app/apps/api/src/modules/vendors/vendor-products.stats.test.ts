import { describe, expect, it } from "vitest";
import { computeProductStats, type ProductStatsInput } from "./vendor-products.stats";

function row(over: Partial<ProductStatsInput> = {}): ProductStatsInput {
  return { status: "active", totalStock: 10, viewCount: 0, favoriteCount: 0, ...over };
}

describe("computeProductStats", () => {
  it("returns zeros for an empty list", () => {
    expect(computeProductStats([])).toEqual({
      total: 0,
      active: 0,
      lowStock: 0,
      outOfStock: 0,
      totalViews: 0,
      totalFavorites: 0,
    });
  });

  it("counts active, low-stock, out-of-stock and sums views/favorites", () => {
    const stats = computeProductStats([
      row({ status: "active", totalStock: 20, viewCount: 5, favoriteCount: 2 }),
      row({ status: "inactive", totalStock: 3, viewCount: 1, favoriteCount: 0 }), // low
      row({ status: "active", totalStock: 0, viewCount: 4, favoriteCount: 1 }), // out
      row({ status: "draft", totalStock: 5, viewCount: 0, favoriteCount: 3 }), // low (sınırda)
    ]);
    expect(stats.total).toBe(4);
    expect(stats.active).toBe(2);
    expect(stats.outOfStock).toBe(1);
    expect(stats.lowStock).toBe(2);
    expect(stats.totalViews).toBe(10);
    expect(stats.totalFavorites).toBe(6);
  });

  it("never double-counts an out-of-stock item as low-stock", () => {
    const stats = computeProductStats([row({ totalStock: 0 })]);
    expect(stats.outOfStock).toBe(1);
    expect(stats.lowStock).toBe(0);
  });
});
