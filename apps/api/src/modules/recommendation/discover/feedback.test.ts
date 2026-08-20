import { describe, expect, it } from "vitest";
import { toFeedbackSets } from "./feedback";

describe("toFeedbackSets", () => {
  it("ürün gizle → hiddenProductIds", () => {
    const s = toFeedbackSets([{ productId: 5, categoryId: null }, { productId: 7, categoryId: null }]);
    expect([...s.hiddenProductIds].sort()).toEqual([5, 7]);
    expect(s.notInterestedCategoryIds.size).toBe(0);
  });

  it("kategori ilgilenme → notInterestedCategoryIds", () => {
    const s = toFeedbackSets([{ productId: null, categoryId: 3 }]);
    expect([...s.notInterestedCategoryIds]).toEqual([3]);
    expect(s.hiddenProductIds.size).toBe(0);
  });

  it("karışık satırlar ayrışır, tekilleşir", () => {
    const s = toFeedbackSets([
      { productId: 1, categoryId: null },
      { productId: 1, categoryId: null },
      { productId: null, categoryId: 9 },
    ]);
    expect(s.hiddenProductIds.size).toBe(1);
    expect(s.notInterestedCategoryIds.size).toBe(1);
  });

  it("boş → boş setler", () => {
    const s = toFeedbackSets([]);
    expect(s.hiddenProductIds.size).toBe(0);
    expect(s.notInterestedCategoryIds.size).toBe(0);
  });
});
