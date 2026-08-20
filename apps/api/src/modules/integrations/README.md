# Stok Entegrasyonu (Gülüm Şalım ↔ Trendyol / İkas)

**Durum:** Temel + iskelet hazır (anahtar-gerektirmeyen kısım). Canlıya almak için
seller API anahtarları + migration + worker bağlama gerekiyor.

## Model
- **Tek gerçek kaynak = Gülüm Şalım DB.** Kanallar uydu: satışı içeri bildirir,
  merkez stoğu düşer, yeni seviye dışarı itilir.
- **Eşleme anahtarı:** `product_variants.sku` (varyantlı) / ürün-türevi barkod
  (varyantsız) → `channel_listings.external_barcode`.
- **Aşırı-satış koruması:** güvenlik tamponu (`exposedStock`) + atomik düşüm
  (`UPDATE ... WHERE stock >= qty`) + transactional outbox + reconcile job.

## Bu klasörde
| Dosya | Ne |
|-------|----|
| `inventory-sync.ts` | SAF çekirdek: tampon, reconcile diff, outbox olay üretimi, backoff. **Tam test kapsamı.** |
| `inventory-sync.test.ts` | 13 test (13/13 geçiyor). |
| `channel-client.ts` | Kanal sözleşmesi + Trendyol/İkas iskelet client (env anahtarı yoksa net hata). |
| `../../db/schema/integrations.ts` | `channel_listings` + `stock_sync_outbox` tabloları + enum'lar. |

## Canlıya alma adımları (anahtar gelince)
1. `.env`'e anahtarlar: `TRENDYOL_SUPPLIER_ID/API_KEY/API_SECRET`, `IKAS_CLIENT_ID/CLIENT_SECRET`. **(Ekrana basılmaz.)**
2. `integrations.ts` şemasını `db/schema/index.ts`'e ekle → `drizzle-kit generate` ile migration üret → uygula.
3. `channel-client.ts` içindeki `pushStock` gövdelerini doldur (Trendyol price-and-inventory batch; İkas GraphQL stok mutation).
4. Webhook route'ları ekle: `POST /webhooks/trendyol`, `POST /webhooks/ikas` → barkoddan listing bul → merkez atomik düş → `buildOutboxEvents` ile diğer kanallara outbox yaz.
5. Kendi satışımızda (`order.repository.ts decrementOrderItemStock`) da `buildOutboxEvents` çağır.
6. Outbox worker (interval/cron): `status='pending' AND next_attempt_at<=now()` çek → client.pushStock → başarı `done`, hata `backoffSeconds` ile yeniden.
7. Reconcile job (15-30 dk): `client.fetchStocks` → `computeReconcileDiff` → farkları outbox'a yaz.
8. Satıcı panelinde ürün/varyanta **barkod** alanı + kanal listing yönetimi.

## Neden hot-patch edilmedi
Yeni DB tabloları içeriyor; migration canlı Postgres'e sizin drizzle akışınızdan
uygulanmalı. Bu yüzden dosyalar yerel repoda, gözden geçirilebilir/geri-alınabilir
şekilde duruyor — canlıya elle basılmadı.
