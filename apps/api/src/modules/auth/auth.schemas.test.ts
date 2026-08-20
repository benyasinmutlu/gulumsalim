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

  it("rejects passwords beyond bcrypt's 72-byte boundary", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "x".repeat(73) }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@example.com", password: "ş".repeat(40), fullName: "Ayşe", membershipConsent: true }).success).toBe(false);
  });
});
