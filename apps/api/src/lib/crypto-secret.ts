import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// =============================================================================
// Simetrik secret şifreleme (AES-256-GCM). Satıcıların kanal (İkas/Trendyol)
// API kimlik bilgileri DB'de ASLA düz metin durmaz. Anahtar env'den gelir:
// INTEGRATIONS_ENC_KEY (64-hex VEYA base64-32byte; değilse sha256 ile türetilir).
// Anahtar yoksa fail-closed (şifreleme/çözme hata verir; düz metin yazılmaz).
// Biçim: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
// =============================================================================

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.INTEGRATIONS_ENC_KEY;
  if (!raw) throw new Error("INTEGRATIONS_ENC_KEY tanımlı değil (kanal kimlik şifreleme anahtarı).");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  if (b.length === 32) return b;
  return createHash("sha256").update(raw).digest(); // son çare: parolayı 32 byte'a türet
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Geçersiz şifreli veri biçimi");
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const data = Buffer.from(parts[3]!, "base64");
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
