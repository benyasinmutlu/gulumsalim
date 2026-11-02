import { beforeAll, describe, expect, it } from "vitest";
import {
  buildOtpAuthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpCode,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  totpStep,
  verifyTotp,
} from "./admin-mfa";

describe("admin MFA primitives", () => {
  beforeAll(() => {
    process.env.MFA_ENC_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("encrypts secrets with randomized authenticated encryption", () => {
    const secret = generateTotpSecret();
    const first = encryptMfaSecret(secret);
    const second = encryptMfaSecret(secret);

    expect(first).not.toBe(second);
    expect(first).not.toContain(secret);
    expect(decryptMfaSecret(first)).toBe(secret);
    expect(() => decryptMfaSecret(`${first.slice(0, -2)}AA`)).toThrow();
  });

  it("accepts the current TOTP window and rejects invalid or expired values", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const atMs = 1_700_000_000_000;
    const code = generateTotpCode(secret, atMs);

    expect(verifyTotp(code, secret, atMs)).toBe(totpStep(atMs));
    expect(verifyTotp(code, secret, atMs + 30_000)).toBe(totpStep(atMs));
    expect(verifyTotp(code, secret, atMs + 90_000)).toBeNull();
    expect(verifyTotp("not-a-code", secret, atMs)).toBeNull();
  });

  it("normalizes and hashes recovery codes without storing plaintext", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);

    const code = codes[0]!;
    const normalized = normalizeRecoveryCode(code);
    const hash = hashRecoveryCode(code);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(normalized);
    expect(hashRecoveryCode(code.toLowerCase().replaceAll("-", " "))).toBe(hash);
  });

  it("builds a standards-compatible issuer-bound enrollment URI", () => {
    const uri = buildOtpAuthUri("JBSWY3DPEHPK3PXP", "admin@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("issuer=G%C3%BCl%C3%BCm%20%C5%9Eal%C4%B1m");
    expect(uri).toContain("digits=6&period=30");
  });
});
