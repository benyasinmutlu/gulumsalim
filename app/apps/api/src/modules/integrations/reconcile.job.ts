import { ALL_CHANNELS, exposedStock } from "./inventory-sync";
import { getChannelClient } from "./channel-client";
import { enqueueOutbox, getEnabledListingsWithStock } from "./inventory-sync.repository";

// Periyodik mutabakat (drift toparlayıcı): her YAPILANDIRILMIŞ kanal için
// kanaldaki güncel stoğu çeker, merkez (tamponlanmış) stokla karşılaştırır,
// FARKLI olanları outbox'a yazar (drainer push eder). Kaçan webhook/push'ları
// güvenli tarafa çeker. Anahtar yoksa / fetchStocks yoksa o kanal atlanır (no-op).

const RECONCILE_INTERVAL_MS = 30 * 60 * 1000; // 30 dk
const SAFETY_BUFFER = 1;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function reconcileOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const channel of ALL_CHANNELS) {
      const client = getChannelClient(channel);
      if (!client.isConfigured() || !client.fetchStocks) continue;

      const listings = await getEnabledListingsWithStock(channel);
      if (listings.length === 0) continue;

      let reported;
      try {
        reported = await client.fetchStocks(listings.map((l) => l.barcode));
      } catch {
        continue; // kanal geçici erişilemez -> sonraki tur
      }
      const reportedMap = new Map(reported.map((r) => [r.externalBarcode, r.stock]));

      for (const l of listings) {
        const target = exposedStock(l.centralStock, SAFETY_BUFFER);
        const channelStock = reportedMap.get(l.barcode);
        // Kanalda yok ya da merkez hedefinden farklı -> düzelt (outbox'a yaz).
        if (channelStock === undefined || channelStock !== target) {
          await enqueueOutbox(l.listingId, target);
        }
      }
    }
  } catch {
    // Tur genel hatası -> sonraki tur yeniden dener.
  } finally {
    running = false;
  }
}

export function startReconcileJob(): void {
  if (!timer) {
    timer = setInterval(() => void reconcileOnce(), RECONCILE_INTERVAL_MS);
    timer.unref?.();
  }
}

export function stopReconcileJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
