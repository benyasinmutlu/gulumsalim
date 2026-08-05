import { backoffSeconds } from "./inventory-sync";
import { getChannelClient } from "./channel-client";
import {
  getDueOutbox,
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

type DueRow = Awaited<ReturnType<typeof getDueOutbox>>[number];

async function handleFail(row: DueRow, error: string): Promise<void> {
  if (row.attempts + 1 >= MAX_ATTEMPTS) {
    await markOutboxFailed(row.id, error);
    await updateListingSyncError(row.listingId, error);
  } else {
    const next = new Date(Date.now() + backoffSeconds(row.attempts + 1) * 1000);
    await markOutboxRetry(row.id, error, next);
  }
}

async function drainOnce(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    const due = await getDueOutbox(BATCH);
    for (const row of due) {
      const client = getChannelClient(row.channel);
      // Anahtar yok ya da listing kapalı -> beklet (pending kalır, hata değil).
      if (!client.isConfigured() || !row.enabled) continue;
      try {
        const res = await client.pushStock([{ externalBarcode: row.externalBarcode, stock: row.targetStock }]);
        if (res.ok) {
          await markOutboxDone(row.id);
          await updateListingSynced(row.listingId, row.targetStock);
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
