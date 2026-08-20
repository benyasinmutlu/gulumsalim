import { describe, expect, it } from "vitest";
import { MIN_SUPPORT, rankCoOccurrence, type CoOccurrenceRow } from "./collaborative";

const r = (productId: number, support: number, vendorId = 10): CoOccurrenceRow => ({ productId, vendorId, support });

describe("rankCoOccurrence", () => {
  it("min-support altındakiler elenir (gizlilik: tek kullanıcı ifşa edilmez)", () => {
    const out = rankCoOccurrence([r(1, 1), r(2, MIN_SUPPORT), r(3, 5)], 10);
    expect(out.map((x) => x.productId)).toEqual([3, 2]); // support 1 elendi
  });

  it("support DESC sıralanır, en yükseğe score=1", () => {
    const out = rankCoOccurrence([r(1, 2), r(2, 8), r(3, 4)], 10);
    expect(out[0]!.productId).toBe(2);
    expect(out[0]!.score).toBe(1);
    expect(out[1]!.productId).toBe(3);
    expect(out[2]!.productId).toBe(1);
  });

  it("score max'a göre normalize (0..1)", () => {
    const out = rankCoOccurrence([r(1, 4), r(2, 8)], 10);
    expect(out.find((x) => x.productId === 1)!.score).toBeCloseTo(0.5, 5);
  });

  it("eşit support → productId DESC ile deterministik", () => {
    const out = rankCoOccurrence([r(1, 3), r(2, 3)], 10);
    expect(out.map((x) => x.productId)).toEqual([2, 1]);
  });

  it("limit uygulanır", () => {
    const out = rankCoOccurrence([r(1, 5), r(2, 4), r(3, 3)], 2);
    expect(out).toHaveLength(2);
  });

  it("boş/hepsi düşük support → []", () => {
    expect(rankCoOccurrence([], 10)).toEqual([]);
    expect(rankCoOccurrence([r(1, 1)], 10)).toEqual([]);
  });

  it("vendorId taşınır (çeşitlilik için sonraki aşama kullanır)", () => {
    const out = rankCoOccurrence([r(1, 3, 99)], 10);
    expect(out[0]!.vendorId).toBe(99);
  });
});
