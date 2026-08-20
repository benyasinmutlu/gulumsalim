import { describe, expect, it } from "vitest";
import { becomeIndividualSellerSchema, vendorRegisterSchema } from "./vendor-auth.schemas";

const base = {
  storeName: "Test Mağaza", storeSlug: "test-magaza", email: "MAGAZA@EXAMPLE.COM", password: "guvenli123",
  fullName: "Ayşe Test", legalAddress: "Uzun ve geçerli bir açık adres", consentAccepted: true,
};

describe("vendor auth schemas", () => {
  it.each(["1234567890", "12345678901", "1234567890123456"])("accepts a supported corporate tax identity: %s", (taxId) => {
    expect(vendorRegisterSchema.parse({ ...base, taxId }).email).toBe("magaza@example.com");
  });

  it("rejects free-form corporate tax identity and non-11-digit individual TCKN", () => {
    expect(vendorRegisterSchema.safeParse({ ...base, taxId: "abcde" }).success).toBe(false);
    expect(becomeIndividualSellerSchema.safeParse({ taxId: "1234567890", legalAddress: base.legalAddress, consentAccepted: true }).success).toBe(false);
  });
});
