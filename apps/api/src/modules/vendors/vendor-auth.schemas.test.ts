import { describe, expect, it } from "vitest";
import { becomeIndividualSellerSchema, updateVendorProfileSchema, vendorRegisterSchema } from "./vendor-auth.schemas";

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

// bkz. kargo/PTT denetim raporu Faz 1 (2026-09-10): satıcının operasyonel
// kargo gönderim adresi - customerAddresses (customers.ts) ile aynı doğrulama
// standardı (min uzunluklar), legalAddress'ten bağımsız, opsiyonel.
describe("updateVendorProfileSchema - shipping address", () => {
  const validShipping = {
    shippingContactName: "Ayşe Test",
    shippingContactPhone: "05551234567",
    shippingCity: "İstanbul",
    shippingDistrict: "Kadıköy",
    shippingAddressLine: "Örnek Mahallesi, Örnek Sokak No:1",
  };

  it("accepts a valid shipping address", () => {
    expect(updateVendorProfileSchema.safeParse(validShipping).success).toBe(true);
  });

  it("allows omitting the shipping address entirely (unrelated to legalAddress)", () => {
    expect(updateVendorProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an empty city or district", () => {
    expect(updateVendorProfileSchema.safeParse({ ...validShipping, shippingCity: "" }).success).toBe(false);
    expect(updateVendorProfileSchema.safeParse({ ...validShipping, shippingDistrict: "" }).success).toBe(false);
  });

  it("rejects a too-short address line", () => {
    expect(updateVendorProfileSchema.safeParse({ ...validShipping, shippingAddressLine: "kısa" }).success).toBe(false);
  });

  it("rejects a too-short phone number", () => {
    expect(updateVendorProfileSchema.safeParse({ ...validShipping, shippingContactPhone: "123" }).success).toBe(false);
  });
});
