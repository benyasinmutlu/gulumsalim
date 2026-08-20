import { describe, expect, it } from "vitest";
import { applyEvent, emptyProfile, mergeAnonymousProfile } from "./profile";

const at = 1_700_000_000_000;

describe("applyEvent", () => {
  it("increments category/brand/color weights on a positive event", () => {
    const p = applyEvent(emptyProfile(true), { type: "product_view", categoryId: 100, brand: "A", colorFamily: "blue", occurredAt: at });
    expect(p.categoryWeights["100"]).toBeGreaterThan(0);
    expect(p.brandWeights["A"]).toBeGreaterThan(0);
    expect(p.colorWeights["blue"]).toBeGreaterThan(0);
  });

  it("weights purchase more strongly than a view", () => {
    const view = applyEvent(emptyProfile(true), { type: "product_view", categoryId: 100, occurredAt: at });
    const purchase = applyEvent(emptyProfile(true), { type: "purchase", categoryId: 100, occurredAt: at });
    expect(purchase.categoryWeights["100"]).toBeGreaterThan(view.categoryWeights["100"]!);
  });

  it("records a negative interest on hide/not_interested", () => {
    const p = applyEvent(emptyProfile(true), { type: "not_interested", categoryId: 100, occurredAt: at });
    expect(p.negativeCategoryIds).toContain(100);
  });

  it("applies decay to existing weights on each update", () => {
    let p = applyEvent(emptyProfile(true), { type: "favorite", brand: "A", occurredAt: at });
    const first = p.brandWeights["A"]!;
    p = applyEvent(p, { type: "product_view", brand: "B", occurredAt: at });
    expect(p.brandWeights["A"]!).toBeLessThan(first); // A ağırlığı sönmüş
  });

  it("keeps recent products bounded and most-recent-first", () => {
    let p = emptyProfile(true);
    for (let i = 1; i <= 3; i++) p = applyEvent(p, { type: "product_view", productId: i, occurredAt: at });
    expect(p.recentProductIds[0]).toBe(3);
  });
});

describe("mergeAnonymousProfile", () => {
  const anon = applyEvent(emptyProfile(true), { type: "favorite", categoryId: 200, brand: "Z", occurredAt: at });

  it("aggregates anonymous weights into a consented target", () => {
    const target = emptyProfile(true);
    const merged = mergeAnonymousProfile(target, anon, "anon-1");
    expect(merged.categoryWeights["200"]).toBeGreaterThan(0);
    expect(merged.mergedSessions).toContain("anon-1");
  });

  it("is idempotent: merging the same session twice is a no-op", () => {
    const target = emptyProfile(true);
    const once = mergeAnonymousProfile(target, anon, "anon-1");
    const twice = mergeAnonymousProfile(once, anon, "anon-1");
    expect(twice).toEqual(once);
  });

  it("does not merge without personalization consent", () => {
    const target = emptyProfile(false);
    expect(mergeAnonymousProfile(target, anon, "anon-1")).toEqual(target);
  });
});
