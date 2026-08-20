import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto-secret";

beforeAll(() => {
  // 32-byte hex test anahtarı
  process.env.INTEGRATIONS_ENC_KEY = "a".repeat(64);
});

describe("crypto-secret (AES-256-GCM)", () => {
  it("şifrele → çöz round-trip", () => {
    const plain = JSON.stringify({ apiKey: "k-123", apiSecret: "s-456", supplierId: "999" });
    const enc = encryptSecret(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("k-123"); // düz metin sızmaz
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("her şifreleme farklı çıktı verir (rastgele IV)", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("bozuk veri → hata", () => {
    expect(() => decryptSecret("bozuk")).toThrow();
    expect(() => decryptSecret("v1:a:b:c")).toThrow();
  });

  it("kurcalanmış ciphertext → auth tag hatası", () => {
    const enc = encryptSecret("gizli");
    const parts = enc.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from("baskaveri").toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
