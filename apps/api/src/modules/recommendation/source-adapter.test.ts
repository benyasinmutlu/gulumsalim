import { describe, expect, it, vi } from "vitest";
import { staticSource, withFallback, type RecommendationSource } from "./source-adapter";

const ctx = { sessionId: "s1", limit: 5 };

describe("withFallback", () => {
  it("returns the primary feed when it is non-empty", async () => {
    const primary = staticSource("primary", [1, 2, 3]);
    const fallback = staticSource("fallback", [9]);
    const feed = await withFallback(primary, fallback).getFeed(ctx);
    expect(feed.productIds).toEqual([1, 2, 3]);
    expect(feed.source).toBe("primary");
  });

  it("falls back when the primary throws", async () => {
    const primary: RecommendationSource = {
      name: "primary",
      getFeed: vi.fn().mockRejectedValue(new Error("discovery down")),
    };
    const fallback = staticSource("fallback", [9, 8]);
    const feed = await withFallback(primary, fallback).getFeed(ctx);
    expect(feed.productIds).toEqual([9, 8]);
    expect(feed.source).toBe("fallback");
  });

  it("falls back when the primary returns an empty feed", async () => {
    const primary = staticSource("primary", []);
    const fallback = staticSource("fallback", [9]);
    const feed = await withFallback(primary, fallback).getFeed(ctx);
    expect(feed.productIds).toEqual([9]);
  });

  it("respects the context limit", async () => {
    const feed = await staticSource("s", [1, 2, 3, 4, 5, 6, 7]).getFeed({ sessionId: "s1", limit: 3 });
    expect(feed.productIds).toEqual([1, 2, 3]);
  });
});
