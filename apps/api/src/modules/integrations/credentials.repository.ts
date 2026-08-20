import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorChannelCredentials } from "../../db/schema/index";
import { decryptSecret, encryptSecret } from "../../lib/crypto-secret";
import type { SalesChannel } from "./inventory-sync";
import type { ChannelCreds } from "./credentials";

// =============================================================================
// Per-vendor kanal kimlik bilgisi deposu. Şifreli (AES-GCM) saklanır; secret'lar
// ASLA düz dönmez (status metotları secret içermez). outbox-drainer + reconcile
// + testConnection buradan çeker.
// =============================================================================

export async function setVendorCredentials(vendorId: number, channel: SalesChannel, creds: ChannelCreds): Promise<void> {
  const encrypted = encryptSecret(JSON.stringify(creds));
  const now = new Date();
  await db
    .insert(vendorChannelCredentials)
    .values({ vendorId, channel, encrypted, status: "connected", lastCheckedAt: now, lastError: null, updatedAt: now })
    .onConflictDoUpdate({
      target: [vendorChannelCredentials.vendorId, vendorChannelCredentials.channel],
      set: { encrypted, status: "connected", lastCheckedAt: now, lastError: null, updatedAt: now },
    });
}

// Şifre çözülmüş creds (drainer/reconcile/test için). Kayıt yoksa/çözülemezse null.
export async function getVendorCredentials(vendorId: number, channel: SalesChannel): Promise<ChannelCreds | null> {
  const [row] = await db
    .select({ encrypted: vendorChannelCredentials.encrypted })
    .from(vendorChannelCredentials)
    .where(and(eq(vendorChannelCredentials.vendorId, vendorId), eq(vendorChannelCredentials.channel, channel)))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(decryptSecret(row.encrypted)) as ChannelCreds;
  } catch {
    return null;
  }
}

// Panel için: secret İÇERMEYEN bağlantı durumu.
export async function getVendorChannelStatuses(
  vendorId: number,
): Promise<{ channel: SalesChannel; connected: boolean; status: string; lastCheckedAt: Date | null; lastError: string | null }[]> {
  const rows = await db
    .select({
      channel: vendorChannelCredentials.channel,
      status: vendorChannelCredentials.status,
      lastCheckedAt: vendorChannelCredentials.lastCheckedAt,
      lastError: vendorChannelCredentials.lastError,
    })
    .from(vendorChannelCredentials)
    .where(eq(vendorChannelCredentials.vendorId, vendorId));
  return rows.map((r) => ({ channel: r.channel, connected: r.status === "connected", status: r.status, lastCheckedAt: r.lastCheckedAt, lastError: r.lastError }));
}

export async function deleteVendorCredentials(vendorId: number, channel: SalesChannel): Promise<void> {
  await db
    .delete(vendorChannelCredentials)
    .where(and(eq(vendorChannelCredentials.vendorId, vendorId), eq(vendorChannelCredentials.channel, channel)));
}

export async function markVendorCredentialError(vendorId: number, channel: SalesChannel, error: string): Promise<void> {
  await db
    .update(vendorChannelCredentials)
    .set({ status: "error", lastError: error.slice(0, 500), lastCheckedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(vendorChannelCredentials.vendorId, vendorId), eq(vendorChannelCredentials.channel, channel)));
}
