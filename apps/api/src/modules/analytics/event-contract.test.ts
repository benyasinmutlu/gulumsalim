import { describe, expect, it } from "vitest";
import {
  buildRecommendationEvent,
  deriveDedupKey,
  RECOMMENDATION_EVENT_SCHEMA_VERSION,
  toBehavioralStreamFields,
  type RecommendationEventInput,
} from "./event-contract";

const base: RecommendationEventInput = {
  type: "product_view",
  occurredAt: 1_700_000_000_500,
  identity: { customerId: 42, sessionId: "sess-1" },
  productId: 7,
  vendorId: 3,
  categoryId: 9,
  source: "home_discover",
  consent: { personalization: true, analytics: true },
};

describe("buildRecommendationEvent", () => {
  it("stamps schema version, eventId and dedupKey on a valid event", () => {
    const e = buildRecommendationEvent(base);
    expect(e.schemaVersion).toBe(RECOMMENDATION_EVENT_SCHEMA_VERSION);
    expect(e.eventId).toMatch(/^[0-9a-f]{24}$/);
    expect(e.dedupKey).toMatch(/^[0-9a-f]{32}$/);
  });

  it("rejects invalid input (unknown type)", () => {
    expect(() => buildRecommendationEvent({ ...base, type: "teleport" })).toThrow();
  });

  it("rejects non-positive productId", () => {
    expect(() => buildRecommendationEvent({ ...base, productId: 0 })).toThrow();
  });

  it("requires a session identity", () => {
    expect(() =>
      buildRecommendationEvent({ ...base, identity: { customerId: 42, sessionId: "" } }),
    ).toThrow();
  });
});

describe("deriveDedupKey (idempotency)", () => {
  it("is stable for the same logical event within the same second", () => {
    const a = deriveDedupKey({ ...base, occurredAt: 1_700_000_000_100 });
    const b = deriveDedupKey({ ...base, occurredAt: 1_700_000_000_900 });
    expect(a).toBe(b); // aynı saniye kovası → aynı dedup key (replay/jitter emniyeti)
  });

  it("differs across products and event types", () => {
    expect(deriveDedupKey(base)).not.toBe(deriveDedupKey({ ...base, productId: 8 }));
    expect(deriveDedupKey(base)).not.toBe(deriveDedupKey({ ...base, type: "favorite" }));
  });

  it("uses customer identity when logged in, session/anon otherwise", () => {
    const loggedIn = deriveDedupKey(base);
    const anon = deriveDedupKey({ ...base, identity: { sessionId: "sess-1", anonymousId: "anon-9" } });
    expect(loggedIn).not.toBe(anon);
  });
});

describe("toBehavioralStreamFields (Redis bridge + consent gating)", () => {
  it("maps the four core types to legacy stream fields", () => {
    const fields = toBehavioralStreamFields(buildRecommendationEvent(base));
    expect(fields).toMatchObject({ type: "view", customerId: "42", productId: "7", categoryId: "9" });
  });

  it("returns null for event types outside the affinity pipeline", () => {
    const impression = buildRecommendationEvent({ ...base, type: "impression" });
    expect(toBehavioralStreamFields(impression)).toBeNull();
  });

  it("does NOT write personal affinity without personalization consent", () => {
    const noConsent = buildRecommendationEvent({
      ...base,
      consent: { personalization: false, analytics: true },
    });
    expect(toBehavioralStreamFields(noConsent)).toBeNull();
  });
});
