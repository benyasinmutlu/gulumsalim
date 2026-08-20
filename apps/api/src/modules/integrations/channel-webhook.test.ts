import { describe, expect, it } from "vitest";
import { deriveChannelWebhookIdentity } from "./channel-webhook";

describe("channel webhook identity", () => {
  it("deduplicates the same payload even when object key order changes", () => {
    const first = deriveChannelWebhookIdentity("trendyol", { order: 42, items: [{ barcode: "A", quantity: 1 }] }, {});
    const second = deriveChannelWebhookIdentity("trendyol", { items: [{ quantity: 1, barcode: "A" }], order: 42 }, {});
    expect(second).toEqual(first);
  });

  it("scopes an identical provider event id by channel", () => {
    const headers = { "x-event-id": "evt-123" };
    expect(deriveChannelWebhookIdentity("trendyol", {}, headers).eventKey).not.toBe(
      deriveChannelWebhookIdentity("ikas", {}, headers).eventKey,
    );
  });

  it("uses a provider idempotency key when supplied", () => {
    const first = deriveChannelWebhookIdentity("trendyol", { deliveryAttempt: 1 }, { "x-idempotency-key": "order-7" });
    const retry = deriveChannelWebhookIdentity("trendyol", { deliveryAttempt: 2 }, { "x-idempotency-key": "order-7" });
    expect(retry.eventKey).toBe(first.eventKey);
    expect(retry.payloadHash).not.toBe(first.payloadHash);
  });
});
