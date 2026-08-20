import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, experimentBucket, recommendationId } from "./contract";

describe("cursor codec", () => {
  it("round-trips an offset", () => {
    expect(decodeCursor(encodeCursor(40))).toBe(40);
  });
  it("treats missing/garbage/negative cursors as offset 0 (fail-safe)", () => {
    expect(decodeCursor(null)).toBe(0);
    expect(decodeCursor("not-base64!!")).toBe(0);
    expect(decodeCursor(Buffer.from(JSON.stringify({ o: -5, v: "discover-v1" })).toString("base64url"))).toBe(0);
  });
  it("ignores cursors from a different algorithm version", () => {
    const stale = Buffer.from(JSON.stringify({ o: 30, v: "discover-v0" })).toString("base64url");
    expect(decodeCursor(stale)).toBe(0);
  });
});

describe("recommendationId", () => {
  it("is deterministic per (request, product)", () => {
    expect(recommendationId("req-1", 7)).toBe(recommendationId("req-1", 7));
    expect(recommendationId("req-1", 7)).not.toBe(recommendationId("req-1", 8));
    expect(recommendationId("req-1", 7)).not.toBe(recommendationId("req-2", 7));
  });
});

describe("experimentBucket", () => {
  it("is stable for the same (experiment, stableId)", () => {
    expect(experimentBucket("exp-1", "user-5")).toBe(experimentBucket("exp-1", "user-5"));
  });
  it("stays within the bucket range", () => {
    for (let i = 0; i < 50; i++) {
      const b = experimentBucket("exp-1", `user-${i}`, 100);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });
});
