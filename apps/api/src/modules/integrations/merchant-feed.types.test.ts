import { describe, expect, it } from "vitest";
import { feedSourceInputSchema } from "./merchant-feed.types";

describe("feed source configuration", () => {
  const valid = {
    name: "Ana katalog",
    provider: "ikas",
    format: "auto",
    url: "https://shop.example.com/feed.xml",
    defaultCategoryId: 1,
    intervalMinutes: 60,
    stockBuffer: 1,
    missingGraceRuns: 3,
    staleAfterMinutes: 180,
    authorizationConfirmed: true,
  } as const;

  it("requires explicit merchant authorization", () => {
    expect(feedSourceInputSchema.safeParse({ ...valid, authorizationConfirmed: false }).success).toBe(false);
  });

  it("does not allow stale protection to be shorter than polling", () => {
    expect(feedSourceInputSchema.safeParse({ ...valid, intervalMinutes: 360, staleAfterMinutes: 180 }).success).toBe(false);
  });
});
