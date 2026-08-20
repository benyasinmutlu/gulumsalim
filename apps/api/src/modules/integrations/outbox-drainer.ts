import { backoffSeconds } from "./inventory-sync";
import { getChannelClient } from "./channel-client";
import { getVendorCredentials } from "./credentials.repository";
import {
  claimDueOutbox,
  markOutboxDone,
  markOutboxFailed,
  markOutboxRetry,
  updateListingSyncError,
  updateListingSynced,
} from "./inventory-sync.repository";

// Transactional outbox drainer (in-process, interval). Bekleyen+zamanı gelmiş
// stok-itme olaylarını çeker, kanala push eder. Anahtar yoksa / listing
// kapalıysa olayı BEKLETİR (hata saymaz) - key gelince otomatik işlenir.
// Tek instance (in-process) + `draining` bayrağı ile örtüşen tick engellenir.

const DRAIN_INTERVAL_MS = 5000;
const BATCH = 50;
const MAX_ATTEMPTS = 8;

let timer: NodeJS.Timeout | null = null;
let draining = false;

type DueRow = Awaited<ReturnType<typeof claimDueOutbox>>[number];

async function handleFail(row: DueRow, error: string): Promise<void> {
  if (!row.claimToken) return;
  if (row.attempts + 1 >= MAX_ATTEMPTS) {
    if (await markOutboxFailed(row.id, row.claimToken, error)) await updateListingSyncError(row.listingId, error);
  } else {
    const next = new Date(Date.now() + backoffSeconds(row.attempts + 1) * 1000);
    await markOutboxRetry(row.id, row.claimToken, error, next);
  }
}

async function drainOnce(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const due = await claimDueOutbox(BATCH);
    for (const row of due) {
      // Listing kapalı -> beklet. Satıcı kendi kanal anahtarını girmemişse ->
      // beklet (pending kalır, hata değil; key girince otomatik işlenir).
      if (!row.enabled) continue;
      const creds = await getVendorCredentials(row.vendorId, row.channel);
      if (!creds) continue;
      const client = getChannelClient(row.channel, creds);
      try {
        const res = await client.pushStock([{ externalBarcode: row.externalBarcode, stock: row.targetStock }]);
        if (res.ok) {
          if (row.claimToken && (await markOutboxDone(row.id, row.claimToken))) {
            await updateListingSynced(row.listingId, row.targetStock);
          }
        } else {
          await handleFail(row, res.error ?? "push başarısız");
        }
      } catch (e) {
        await handleFail(row, e instanceof Error ? e.message : "push hatası");
      }
    }
  } catch {
    // Tick genel hatası (ör. DB anlık erişilemez) - sıradaki tick yeniden dener.
  } finally {
    draining = false;
  }
}

export function startOutboxDrainer(): void {
  if (!timer) {
    timer = setInterval(() => {
      void drainOnce();
    }, DRAIN_INTERVAL_MS);
    timer.unref?.();
  }
}

export function stopOutboxDrainer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
