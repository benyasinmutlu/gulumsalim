import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCheckoutFormSignature, verifyRefundSignature, type CheckoutFormRetrieveResult } from "./iyzico.client";

const secret = "test-secret";
const base = {
  status: "success", paymentStatus: "SUCCESS", fraudStatus: 1, paymentId: "pay-1", currency: "TRY",
  basketId: "GS1", conversationId: "conv-1", paidPrice: "149.90", price: "100.00", token: "tok-1",
} satisfies Omit<CheckoutFormRetrieveResult, "signature">;

function sign(result: typeof base) {
  const payload = [result.paymentStatus, result.paymentId, result.currency, result.basketId, result.conversationId, "149.9", "100", result.token].join(":");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("iyzico checkout response signature", () => {
  it("validates the documented parameter order and decimal normalization", () => {
    expect(verifyCheckoutFormSignature({ ...base, signature: sign(base) }, secret)).toBe(true);
  });

  it("rejects tampering and missing signatures", () => {
    const signature = sign(base);
    expect(verifyCheckoutFormSignature({ ...base, paidPrice: "1", signature }, secret)).toBe(false);
    expect(verifyCheckoutFormSignature(base, secret)).toBe(false);
  });
});

describe("iyzico refund response signature", () => {
  it("validates the documented refund signature order", () => {
    const payload = "pay-1:10.5:TRY:refund-conv";
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyRefundSignature({
      status: "success", paymentId: "pay-1", price: "10.50", currency: "TRY", conversationId: "refund-conv", signature,
    }, secret)).toBe(true);
  });
});
