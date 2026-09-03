import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

const CONTRACT_TOKEN_VERSION = 1;
const CONTRACT_TOKEN_TTL_MS = 30 * 60 * 1000;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function checkoutPayloadDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function signature(encodedPayload: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`checkout-contract:${encodedPayload}`)
    .digest("base64url");
}

export function createContractAcceptanceToken(value: unknown, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: CONTRACT_TOKEN_VERSION,
      exp: now + CONTRACT_TOKEN_TTL_MS,
      digest: checkoutPayloadDigest(value),
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyContractAcceptanceToken(token: string | undefined, value: unknown, now = Date.now()): boolean {
  if (!token || token.length > 1024) return false;
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return false;

  const expectedSignature = Buffer.from(signature(encodedPayload));
  const supplied = Buffer.from(suppliedSignature);
  if (expectedSignature.length !== supplied.length || !timingSafeEqual(expectedSignature, supplied)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      v?: number;
      exp?: number;
      digest?: string;
    };
    if (parsed.v !== CONTRACT_TOKEN_VERSION || !Number.isFinite(parsed.exp) || parsed.exp! < now) return false;
    if (!parsed.digest || !/^[a-f0-9]{64}$/i.test(parsed.digest)) return false;
    const expectedDigest = Buffer.from(checkoutPayloadDigest(value), "hex");
    const suppliedDigest = Buffer.from(parsed.digest, "hex");
    return expectedDigest.length === suppliedDigest.length && timingSafeEqual(expectedDigest, suppliedDigest);
  } catch {
    return false;
  }
}
