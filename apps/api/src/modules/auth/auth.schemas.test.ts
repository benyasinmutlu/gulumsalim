import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth.schemas";

describe("customer auth schemas", () => {
  it("normalizes e-mail and trims identity fields", () => {
    const parsed = registerSchema.parse({
      email: "  TEST@Example.COM ", password: "guvenli123", fullName: "  Ayşe Test  ",
      membershipConsent: true,
    });
    expect(parsed.email).toBe("test@example.com");
    expect(parsed.fullName).toBe("Ayşe Test");
  });

  // bkz. denetim raporu madde 6: "zeynep sümengen" gibi tamamen küçük harfli
  // isimler artık başlık formatına çevrilir (bkz. lib/name-case.ts).
  it("title-cases a fully lowercase name", () => {
    const parsed = registerSchema.parse({
      email: "zeynep@example.com", password: "guvenli123", fullName: "zeynep sümengen",
      membershipConsent: true,
    });
    expect(parsed.fullName).toBe("Zeynep Sümengen");
  });

  it("rejects passwords beyond bcrypt's 72-byte boundary", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(73) }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@example.com", password: "ş".repeat(40), fullName: "Ayşe", membershipConsent: true }).success).toBe(false);
  });
});
