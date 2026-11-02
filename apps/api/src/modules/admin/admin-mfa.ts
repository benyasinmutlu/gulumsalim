import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function mfaKey(): Buffer {
  const raw = process.env.MFA_ENC_KEY;
  if (!raw || raw.length < 32) throw new Error("MFA_ENC_KEY tanımlı değil veya çok kısa");
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

export function isMfaConfigured(): boolean {
  return typeof process.env.MFA_ENC_KEY === "string" && process.env.MFA_ENC_KEY.length >= 32;
}

export function encryptMfaSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptMfaSecret(payload: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Geçersiz MFA secret biçimi");
  const decipher = createDecipheriv("aes-256-gcm", mfaKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64")), decipher.final()]).toString("utf8");
}

function encodeBase32(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Geçersiz Base32 MFA secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function totpStep(atMs = Date.now()): number {
  return Math.floor(atMs / 1000 / TOTP_PERIOD_SECONDS);
}

function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return binary.toString().padStart(TOTP_DIGITS, "0");
}

export function generateTotpCode(secret: string, atMs = Date.now()): string {
  return codeForStep(secret, totpStep(atMs));
}

export function verifyTotp(code: string, secret: string, atMs = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const candidate = Buffer.from(code);
  const current = totpStep(atMs);
  for (const delta of [-1, 0, 1]) {
    const step = current + delta;
    const expected = Buffer.from(codeForStep(secret, step));
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return step;
  }
  return null;
}

export function buildOtpAuthUri(secret: string, username: string): string {
  const issuer = "Gülüm Şalım";
  const label = `${issuer}:${username}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(10).toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-"));
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-F0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", mfaKey()).update(normalizeRecoveryCode(code)).digest("hex");
}
