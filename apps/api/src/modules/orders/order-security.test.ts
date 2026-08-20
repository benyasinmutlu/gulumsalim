import { describe, expect, it } from "vitest";
import { isVerifiedSuccessfulPayment, verifyPaymentItemTransactions } from "./order-security";

const order = {
  orderNumber: "GS17000000001",
  paymentRef: "provider-token",
  subtotal: "100.00",
  total: "149.90",
};

const result = {
  status: "success",
  paymentStatus: "SUCCESS",
  fraudStatus: 1,
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
    ["fraud status", { fraudStatus: 0 }],
    ["missing fraud status", { fraudStatus: undefined }],
    ["provider token", { token: "other-token" }],
    ["basket / order number", { basketId: "another-order" }],
    ["subtotal", { price: "0.01" }],
    ["paid total", { paidPrice: "0.01" }],
    ["invalid money format", { paidPrice: "149.900" }],
  ])("rejects a mismatched %s", (_label, patch) => {
    expect(isVerifiedSuccessfulPayment({ ...result, ...patch }, order)).toBe(false);
  });
});

describe("verifyPaymentItemTransactions", () => {
  it("maps modern UUID basket references to exact order items", () => {
    expect(verifyPaymentItemTransactions(
      [{ itemId: "ref-b", paymentTransactionId: "tx-b" }, { itemId: "ref-a", paymentTransactionId: "tx-a" }],
      [{ id: 1, productId: 10, paymentItemRef: "ref-a" }, { id: 2, productId: 10, paymentItemRef: "ref-b" }],
    )).toEqual([
      { orderItemId: 1, paymentTransactionId: "tx-a" },
      { orderItemId: 2, paymentTransactionId: "tx-b" },
    ]);
  });

  it("supports legacy product ids only when products are unique", () => {
    expect(verifyPaymentItemTransactions(
      [{ itemId: "10", paymentTransactionId: "tx-a" }],
      [{ id: 1, productId: 10, paymentItemRef: null }],
    )).toEqual([{ orderItemId: 1, paymentTransactionId: "tx-a" }]);
    expect(verifyPaymentItemTransactions(
      [{ itemId: "10", paymentTransactionId: "tx-a" }, { itemId: "11", paymentTransactionId: "tx-b" }],
      [{ id: 1, productId: 10, paymentItemRef: null }, { id: 2, productId: 10, paymentItemRef: null }],
    )).toBeNull();
  });

  it("rejects missing, duplicate or incomplete provider mappings", () => {
    const orderItems = [{ id: 1, productId: 10, paymentItemRef: "ref-a" }];
    expect(verifyPaymentItemTransactions(undefined, orderItems)).toBeNull();
    expect(verifyPaymentItemTransactions([{ itemId: "ref-a" }], orderItems)).toBeNull();
    expect(verifyPaymentItemTransactions([{ itemId: "other", paymentTransactionId: "tx" }], orderItems)).toBeNull();
  });
});
