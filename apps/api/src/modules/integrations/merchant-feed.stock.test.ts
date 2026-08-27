import { describe, expect, it } from "vitest";
import { applyFeedStockDelta, nextFeedRunAt } from "./merchant-feed.stock";

describe("merchant feed stock delta", () => {
  it("preserves Gülüm Şalım sales when source stock is unchanged", () => {
    expect(applyFeedStockDelta(9, 10, 10, true)).toBe(9);
  });

  it("applies external channel stock movement on top of local sales", () => {
    expect(applyFeedStockDelta(9, 10, 8, true)).toBe(7);
    expect(applyFeedStockDelta(7, 8, 12, true)).toBe(11);
  });

  it("never goes negative and restores a previously fail-closed item", () => {
    expect(applyFeedStockDelta(1, 10, 0, true)).toBe(0);
    expect(applyFeedStockDelta(0, 10, 10, false)).toBe(10);
  });
});

describe("merchant feed scheduling", () => {
  it("spreads recurring pulls within a ten percent jitter window", () => {
    const now = Date.UTC(2026, 7, 27);
    expect(nextFeedRunAt(now, 60, () => 0).getTime()).toBe(now + 54 * 60_000);
    expect(nextFeedRunAt(now, 60, () => 1).getTime()).toBe(now + 66 * 60_000);
  });
});
