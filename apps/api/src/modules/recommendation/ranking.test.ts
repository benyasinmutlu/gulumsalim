import { describe, expect, it } from "vitest";
import {
  DEFAULT_V1_WEIGHTS,
  rankLegacyPassthrough,
  rankV1,
  scoreCandidate,
  selectRankingStrategy,
  type RankingCandidate,
} from "./ranking";

function candidate(productId: number, vendorId: number, features: RankingCandidate["features"]): RankingCandidate {
  return { productId, vendorId, features };
}

const pool: RankingCandidate[] = [
  candidate(1, 10, { categoryAffinity: 0.9, availability: 1, recency: 0.5 }),
  candidate(2, 10, { categoryAffinity: 0.8, availability: 1, recency: 0.4 }),
  candidate(3, 11, { categoryAffinity: 0.7, availability: 1, popularity: 0.9 }),
  candidate(4, 12, { categoryAffinity: 0.2, availability: 0 }), // stokta yok
];

describe("rankV1", () => {
  it("is deterministic across repeated calls", () => {
    const a = rankV1(pool, { limit: 10 });
    const b = rankV1(pool, { limit: 10 });
    expect(a.map((x) => x.productId)).toEqual(b.map((x) => x.productId));
  });

  it("filters out unavailable products", () => {
    const ids = rankV1(pool, { limit: 10 }).map((x) => x.productId);
    expect(ids).not.toContain(4);
  });

  it("enforces per-vendor diversity cap", () => {
    const many = [
      candidate(1, 99, { categoryAffinity: 0.9, availability: 1 }),
      candidate(2, 99, { categoryAffinity: 0.8, availability: 1 }),
      candidate(3, 99, { categoryAffinity: 0.7, availability: 1 }),
      candidate(4, 99, { categoryAffinity: 0.6, availability: 1 }),
    ];
    const out = rankV1(many, { limit: 10, maxPerVendor: 2 });
    expect(out).toHaveLength(2);
  });

  it("breaks score ties deterministically by productId desc", () => {
    const tied = [
      candidate(1, 1, { categoryAffinity: 0.5, availability: 1 }),
      candidate(2, 2, { categoryAffinity: 0.5, availability: 1 }),
    ];
    expect(rankV1(tied, { limit: 10 }).map((x) => x.productId)).toEqual([2, 1]);
  });

  it("penalizes negative feedback so it ranks lower", () => {
    const items = [
      candidate(1, 1, { categoryAffinity: 0.6, availability: 1, negativeFeedback: 0.9 }),
      candidate(2, 2, { categoryAffinity: 0.6, availability: 1, negativeFeedback: 0 }),
    ];
    expect(rankV1(items, { limit: 10 })[0]!.productId).toBe(2);
  });
});

describe("scoreCandidate explanation", () => {
  it("returns non-zero contributions sorted by magnitude", () => {
    const item = scoreCandidate(
      candidate(1, 1, { categoryAffinity: 1, popularity: 0.5, negativeFeedback: 0.2 }),
      DEFAULT_V1_WEIGHTS,
    );
    expect(item.explanation.length).toBeGreaterThan(0);
    expect(item.explanation.length).toBeLessThanOrEqual(3);
    for (const c of item.explanation) expect(c.contribution).not.toBe(0);
    const mags = item.explanation.map((c) => Math.abs(c.contribution));
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
    expect(item.explanation[0]!.feature).toBe("categoryAffinity");
  });
});

describe("selectRankingStrategy (feature flag fallback)", () => {
  it("uses v1 only when explicitly enabled", () => {
    expect(selectRankingStrategy("v1")).toBe("v1");
  });
  it.each([undefined, "", "legacy", "garbage"])("falls back to legacy for %p", (flag) => {
    expect(selectRankingStrategy(flag as string | undefined)).toBe("legacy");
  });
});

describe("rankLegacyPassthrough", () => {
  it("preserves discovery order with descending scores", () => {
    const vendors = new Map([[7, 1], [8, 2], [9, 3]]);
    const out = rankLegacyPassthrough([7, 8, 9], vendors);
    expect(out.map((x) => x.productId)).toEqual([7, 8, 9]);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
    expect(out.every((x) => x.strategy === "legacy")).toBe(true);
  });
});
