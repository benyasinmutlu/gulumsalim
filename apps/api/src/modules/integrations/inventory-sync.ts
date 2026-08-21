// Merkezî stok ↔ dış kanal (Trendyol / İkas) senkronizasyonunun SAF çekirdeği.
// Buradaki fonksiyonlar DB/ağ'a dokunmaz -> kolayca test edilir. Yan etkiler
// (atomik düşüm, HTTP push) ayrı repository/client katmanındadır.
//
// Tasarım kararı (bkz. kullanıcı: "Gülüm Şalım'dan veya ikastan ya da
// trendyoldan satılan ürünün stok durumu 2 taraftan da düşülmeli"):
//   - TEK gerçek kaynak = Gülüm Şalım DB. İkas/Trendyol uydu kanaldır.
//   - Her kanal satışı İÇERİ bildirir (webhook/polling), merkez stoğu düşürür.
//   - Merkez stok her değiştiğinde diğer kanallara güncel seviye İTİLİR.
//   - Aşırı-satışa karşı: güvenlik tamponu + atomik düşüm + outbox + reconcile.

export type SalesChannel = "trendyol" | "ikas" | "ticimax";

export const ALL_CHANNELS: SalesChannel[] = ["trendyol", "ikas", "ticimax"];

// Bir kanala AÇIK edilecek stok. Propagation gecikmesinde son ürünü iki yerde
// birden satmayı önlemek için gerçek stoktan tampon düşülür (asla negatif
// gösterilmez). buffer=1 önerilir; hızlı dönen üründe artırılabilir.
export function exposedStock(centralStock: number, buffer: number): number {
  if (!Number.isFinite(centralStock) || centralStock <= 0) return 0;
  const b = Number.isFinite(buffer) && buffer > 0 ? Math.floor(buffer) : 0;
  return Math.max(0, Math.floor(centralStock) - b);
}

// Kanalın "kaç adet sattım" bildirimini merkez stoğa uygulanacak düşüm
// miktarına çevirir. Negatif/NaN gelirse 0 (güvenli). İadе/iptal (negatif
// satış) desteği için allowNegative=true ile artış da yapılabilir.
export function decrementAmount(reportedQty: number, allowNegative = false): number {
  if (!Number.isFinite(reportedQty)) return 0;
  const q = Math.trunc(reportedQty);
  if (q < 0) return allowNegative ? q : 0;
  return q;
}

export interface ChannelStockRow {
  listingId: number;
  channel: SalesChannel;
  reportedStock: number; // kanalın ŞU AN gösterdiği stok
}

export interface ReconcileCorrection {
  listingId: number;
  channel: SalesChannel;
  from: number; // kanaldaki mevcut (yanlış olabilir)
  to: number; // merkeze göre olması gereken (tampon uygulanmış)
}

// Periyodik mutabakat (kaçan webhook'ları toparlar): merkez stok ile kanalın
// bildirdiği stoğu karşılaştırır, sadece FARKLI olanlar için düzeltme üretir.
export function computeReconcileDiff(
  centralStock: number,
  buffer: number,
  channelRows: ChannelStockRow[],
): ReconcileCorrection[] {
  const target = exposedStock(centralStock, buffer);
  const out: ReconcileCorrection[] = [];
  for (const row of channelRows) {
    const current = Number.isFinite(row.reportedStock) ? Math.floor(row.reportedStock) : 0;
    if (current !== target) {
      out.push({ listingId: row.listingId, channel: row.channel, from: current, to: target });
    }
  }
  return out;
}

export type OutboxStatus = "pending" | "processing" | "done" | "error";

export interface StockSyncEvent {
  channel: SalesChannel;
  listingId: number;
  targetStock: number;
}

// Merkez stok değişince, DEĞİŞEN ürünün AKTİF olduğu tüm kanallar için
// (opsiyonel olarak tetikleyen kanal hariç) itilecek outbox olaylarını üretir.
// exceptChannel: satışın geldiği kanal - oraya geri itmeye gerek yok.
export function buildOutboxEvents(
  centralStock: number,
  buffer: number,
  activeListings: { listingId: number; channel: SalesChannel }[],
  exceptChannel?: SalesChannel,
): StockSyncEvent[] {
  const target = exposedStock(centralStock, buffer);
  return activeListings
    .filter((l) => l.channel !== exceptChannel)
    .map((l) => ({ channel: l.channel, listingId: l.listingId, targetStock: target }));
}

// Basit üstel geri çekilme (outbox worker yeniden deneme aralığı, saniye).
export function backoffSeconds(attempt: number, baseSeconds = 30, maxSeconds = 3600): number {
  if (attempt <= 0) return baseSeconds;
  const delay = baseSeconds * 2 ** Math.min(attempt, 12);
  return Math.min(delay, maxSeconds);
}
