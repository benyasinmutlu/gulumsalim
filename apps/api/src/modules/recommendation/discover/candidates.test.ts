import { describe, expect, it } from "vitest";
import {
  dedupCandidates,
  gatherCandidates,
  type CandidateContext,
  type CandidateSource,
} from "./candidates";
import type { Candidate } from "./contract";

function cand(over: Partial<Candidate> & { productId: number; source: Candidate["source"]; rawScore: number }): Candidate {
  return { vendorId: 1, reason: "popular", version: "v", generatedAt: 0, ...over };
}

const ctx: CandidateContext = {
  sessionId: "s1",
  limit: 5,
  topCategoryIds: [1],
  recentProductIds: [1],
  knownBrands: new Set(),
};

function source(name: Candidate["source"], out: Candidate[] | (() => Promise<Candidate[]>)): CandidateSource {
  return { name, generate: typeof out === "function" ? out : async () => out };
}

describe("dedupCandidates", () => {
  it("keeps the highest rawScore per product", () => {
    const out = dedupCandidates([
      cand({ productId: 1, source: "trending", rawScore: 0.4 }),
      cand({ productId: 1, source: "personal_history", rawScore: 0.9 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.rawScore).toBe(0.9);
    expect(out[0]!.source).toBe("personal_history");
  });

  it("breaks equal rawScore by source priority", () => {
    const out = dedupCandidates([
      cand({ productId: 1, source: "popular_fallback", rawScore: 0.5 }),
      cand({ productId: 1, source: "personal_history", rawScore: 0.5 }),
    ]);
    expect(out[0]!.source).toBe("personal_history");
  });
});

describe("gatherCandidates", () => {
  it("isolates a failing source and keeps the others", async () => {
    const good = source("trending", [cand({ productId: 2, source: "trending", rawScore: 0.5 })]);
    const bad = source("personal_history", async () => {
      throw new Error("down");
    });
    const fb = source("popular_fallback", []);
    const res = await gatherCandidates([good, bad], fb, ctx);
    expect(res.candidates.map((c) => c.productId)).toEqual([2]);
    expect(res.fallbackUsed).toBe(false);
    expect(res.perSourceCounts.personal_history).toBe(0);
  });

  it("uses the fallback when every source is empty", async () => {
    const fb = source("popular_fallback", [cand({ productId: 9, source: "popular_fallback", rawScore: 0.5 })]);
    const res = await gatherCandidates([source("trending", []), source("exploration", [])], fb, ctx);
    expect(res.fallbackUsed).toBe(true);
    expect(res.candidates.map((c) => c.productId)).toEqual([9]);
  });
});
