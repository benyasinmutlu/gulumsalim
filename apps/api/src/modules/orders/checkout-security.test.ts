import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({ env: { SESSION_SECRET: "test-secret-that-is-definitely-long-enough" } }));

import {
  checkoutPayloadDigest,
  createContractAcceptanceToken,
  verifyContractAcceptanceToken,
} from "./checkout-security";

describe("checkout security", () => {
  it("produces a stable digest independent of object key order", () => {
    expect(checkoutPayloadDigest({ b: 2, a: { d: 4, c: 3 } })).toBe(
      checkoutPayloadDigest({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it("binds acceptance to the exact checkout state", () => {
    const state = { session: "s1", identityNumber: "12345", cart: [{ productId: 7, quantity: 1 }] };
    const token = createContractAcceptanceToken(state, 1_000);

    expect(verifyContractAcceptanceToken(token, state, 2_000)).toBe(true);
    expect(verifyContractAcceptanceToken(token, { ...state, identityNumber: "99999" }, 2_000)).toBe(false);
    expect(verifyContractAcceptanceToken(token, { ...state, cart: [{ productId: 7, quantity: 2 }] }, 2_000)).toBe(false);
  });

  it("rejects expired and tampered tokens", () => {
    const state = { session: "s1" };
    const token = createContractAcceptanceToken(state, 1_000);
    expect(verifyContractAcceptanceToken(token, state, 1_000 + 30 * 60 * 1000 + 1)).toBe(false);
    expect(verifyContractAcceptanceToken(`${token}x`, state, 2_000)).toBe(false);
  });
});
