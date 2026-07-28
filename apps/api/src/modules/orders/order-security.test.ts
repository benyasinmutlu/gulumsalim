import { describe, expect, it } from "vitest";
import { isVerifiedSuccessfulPayment } from "./order-security";

const order = {
  orderNumber: "GS17000000001",
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

describe("isVerifiedSuccessfulPayment", () => {
  it("accepts a provider success only when it belongs to the order and amounts match", () => {
    expect(isVerifiedSuccessfulPayment(result, order)).toBe(true);
  });

  it.each([
    ["status", { status: "failure" }],
    ["payment status", { paymentStatus: "FAILURE" }],
    ["provider token", { token: "other-token" }],
    ["basket / order number", { basketId: "another-order" }],
    ["subtotal", { price: "0.01" }],
    ["paid total", { paidPrice: "0.01" }],
    ["invalid money format", { paidPrice: "149.900" }],
  ])("rejects a mismatched %s", (_label, patch) => {
    expect(isVerifiedSuccessfulPayment({ ...result, ...patch }, order)).toBe(false);
  });
});
