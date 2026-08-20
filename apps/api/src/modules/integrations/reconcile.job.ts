import { ALL_CHANNELS, exposedStock } from "./inventory-sync";
import { getChannelClient } from "./channel-client";
import { getVendorCredentials } from "./credentials.repository";
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
      const listings = await getEnabledListingsWithStock(channel);
      if (listings.length === 0) continue;

      // Per-vendor grupla: her satıcının listing'leri kendi creds'iyle çekilir.
      const byVendor = new Map<number, typeof listings>();
      for (const l of listings) {
        const arr = byVendor.get(l.vendorId) ?? [];
        arr.push(l);
        byVendor.set(l.vendorId, arr);
      }

      for (const [vendorId, vendorListings] of byVendor) {
        const creds = await getVendorCredentials(vendorId, channel);
        if (!creds) continue; // satıcı bu kanalı bağlamamış -> atla
        const client = getChannelClient(channel, creds);
        if (!client.fetchStocks) continue;

        let reported;
        try {
          reported = await client.fetchStocks(vendorListings.map((l) => l.barcode));
        } catch {
          continue; // kanal geçici erişilemez -> sonraki tur
        }
        const reportedMap = new Map(reported.map((r) => [r.externalBarcode, r.stock]));

        for (const l of vendorListings) {
          const target = exposedStock(l.centralStock, SAFETY_BUFFER);
          const channelStock = reportedMap.get(l.barcode);
          if (channelStock === undefined || channelStock !== target) {
            await enqueueOutbox(l.listingId, target);
          }
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
