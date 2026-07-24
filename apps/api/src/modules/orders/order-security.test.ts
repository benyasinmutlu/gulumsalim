import { describe, expect, it } from "vitest";
import {
  createPublicOrderNumber,
  isVerifiedSuccessfulPayment,
} from "./order-security";

describe("createPublicOrderNumber", () => {
  it("uses an opaque, cryptographically random identifier", () => {
    const values = Array.from({ length: 100 }, () => createPublicOrderNumber());

    expect(new Set(values)).toHaveLength(values.length);
    for (const value of values) {
      expect(value).toMatch(/^GS-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});

describe("isVerifiedSuccessfulPayment", () => {
  const order = {
    orderNumber: "GS-8ccdb3ab-c640-4fb6-93c7-2e100b66d4c4",
    paymentRef: "provider-token",
    subtotal: "100.00",
    total: "149.90",
  };

  const result = {
    status: "success",
    paymentStatus: "SUCCESS",
    token: "provider-token",
    basketId: order.orderNumber,
    price: "100",
    paidPrice: "149.9",
  };

  it("accepts a provider success only when it belongs to the order and amounts match", () => {
    expect(isVerifiedSuccessfulPayment(result, order)).toBe(true);
  });

  it.each([
    ["status", { status: "failure" }],
    ["payment status", { paymentStatus: "FAILURE" }],
    ["provider token", { token: "other-token" }],
    ["basket", { basketId: "another-order" }],
    ["subtotal", { price: "0.01" }],
    ["paid total", { paidPrice: "0.01" }],
    ["invalid money", { paidPrice: "149.900" }],
  ])("rejects a mismatched %s", (_label, patch) => {
    expect(isVerifiedSuccessfulPayment({ ...result, ...patch }, order)).toBe(false);
  });
});
