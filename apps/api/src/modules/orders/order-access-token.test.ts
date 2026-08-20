import { describe, expect, it } from "vitest";
import { createOrderAccessToken, verifyOrderAccessToken } from "./order-access-token";

describe("order access token", () => {
  it("accepts only the signature bound to the exact order number", () => {
    const token = createOrderAccessToken("GS17000000001");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyOrderAccessToken("GS17000000001", token)).toBe(true);
    expect(verifyOrderAccessToken("GS17000000002", token)).toBe(false);
  });

  it("rejects missing, malformed and tampered values", () => {
    expect(verifyOrderAccessToken("GS1", undefined)).toBe(false);
    expect(verifyOrderAccessToken("GS1", "not-a-token")).toBe(false);
    const token = createOrderAccessToken("GS1");
    const replacement = token.endsWith("0") ? "1" : "0";
    expect(verifyOrderAccessToken("GS1", `${token.slice(0, -1)}${replacement}`)).toBe(false);
  });
});
