import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_BATCH,
  TIMESTAMP_SKEW_MS,
  validateClientEvent,
  validateEventBatch,
  type RawClientEvent,
  type TrustedEventContext,
} from "./event-security";

const ctx: TrustedEventContext = {
  sessionCustomerId: 42,
  sessionId: "sess-1",
  nowMs: 1_700_000_000_000,
  consentPersonalization: true,
};

describe("validateClientEvent", () => {
  it("derives customerId from the session, ignoring any client-supplied value", () => {
    // Body'de customerId:9999 gönderilse bile okunmaz (tip zaten kabul etmez).
    const res = validateClientEvent({ type: "product_view", productId: 7, source: "pdp" } as RawClientEvent, ctx);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.event.customerId).toBe(42);
  });

  it("rejects client-sent purchase (server-only event)", () => {
    const res = validateClientEvent({ type: "purchase", productId: 7 }, ctx);
    expect(res).toEqual({ ok: false, reason: "server_only_event" });
  });

  it("rejects unsupported event types", () => {
    expect(validateClientEvent({ type: "teleport" }, ctx)).toEqual({ ok: false, reason: "unsupported_type" });
  });

  it("rejects timestamps outside the allowed skew", () => {
    const res = validateClientEvent({ type: "click", occurredAt: ctx.nowMs + TIMESTAMP_SKEW_MS + 1000 }, ctx);
    expect(res).toEqual({ ok: false, reason: "timestamp_skew" });
  });

  it("rejects oversized metadata", () => {
    const res = validateClientEvent({ type: "click", metadata: { blob: "x".repeat(500) } }, ctx);
    expect(res).toEqual({ ok: false, reason: "metadata_too_large" });
  });

  it("does not write personal profile without consent", () => {
    const res = validateClientEvent({ type: "product_view", productId: 7 }, { ...ctx, consentPersonalization: false });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.event.writeProfile).toBe(false);
  });
});

describe("validateEventBatch", () => {
  it("enforces the batch size limit", () => {
    const many: RawClientEvent[] = Array.from({ length: MAX_EVENT_BATCH + 5 }, (_, i) => ({
      type: "product_view",
      productId: i + 1,
    }));
    const { accepted, rejected } = validateEventBatch(many, ctx);
    expect(accepted.length).toBeLessThanOrEqual(MAX_EVENT_BATCH);
    expect(rejected.some((r) => r.reason === "batch_limit")).toBe(true);
  });

  it("drops duplicate events within a batch (idempotency)", () => {
    const dup: RawClientEvent = { type: "product_view", productId: 7, source: "pdp", occurredAt: ctx.nowMs };
    const { accepted, rejected } = validateEventBatch([dup, { ...dup }], ctx);
    expect(accepted).toHaveLength(1);
    expect(rejected).toContainEqual({ index: 1, reason: "duplicate" });
  });
});
