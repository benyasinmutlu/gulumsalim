import { createHash } from "node:crypto";
import type { SalesChannel } from "./inventory-sync";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return "null";
}

function headerValue(headers: Record<string, unknown>, name: string): string | null {
  const value = headers[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
  return null;
}

export function deriveChannelWebhookIdentity(
  channel: SalesChannel,
  body: unknown,
  headers: Record<string, unknown>,
): { eventKey: string; payloadHash: string } {
  const canonicalPayload = canonicalJson(body);
  const payloadHash = createHash("sha256").update(canonicalPayload).digest("hex");
  const providerEventId =
    headerValue(headers, "x-idempotency-key") ??
    headerValue(headers, "x-event-id") ??
    headerValue(headers, "x-webhook-id");
  const material = providerEventId ? `provider:${providerEventId}` : `payload:${payloadHash}`;
  const eventKey = createHash("sha256").update(`${channel}:${material}`).digest("hex");
  return { eventKey, payloadHash };
}
