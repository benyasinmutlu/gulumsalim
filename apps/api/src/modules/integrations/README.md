# Stok Entegrasyonu (Gülüm Şalım ↔ Trendyol / İkas / Ticimax)

**Durum:** Kanal bağlantısı, şifreli satıcı kimlik bilgileri, atomik stok
düşümü, transactional outbox, retry ve mutabakat worker'ı bağlıdır.

## Model
- **Tek gerçek kaynak = Gülüm Şalım DB.** Kanallar uydu: satışı içeri bildirir,
  merkez stoğu düşer, yeni seviye dışarı itilir.
- **Eşleme anahtarı:** Trendyol/İkas için barkod/SKU; Ticimax için sipariş
  eşleşmesinde barkod, stok güncellemesinde ayrıca sayısal varyasyon ID.
- **Aşırı-satış koruması:** güvenlik tamponu (`exposedStock`) + atomik düşüm
  (`UPDATE ... WHERE stock >= qty`) + transactional outbox + reconcile job.

## Bu klasörde
| Dosya | Ne |
|-------|----|
| `inventory-sync.ts` | SAF çekirdek: tampon, reconcile diff, outbox olay üretimi, backoff. **Tam test kapsamı.** |
| `inventory-sync.test.ts` | Tampon, reconcile, outbox ve backoff testleri. |
| `channel-client.ts` | Trendyol REST, İkas OAuth/GraphQL ve Ticimax WCF/SOAP istemcileri. |
| `../../db/schema/integrations.ts` | `channel_listings` + `stock_sync_outbox` tabloları + enum'lar. |

## Canlı kullanım notları
1. `INTEGRATIONS_ENC_KEY` ve `INTEGRATIONS_WEBHOOK_SECRET` sunucu env'inde tanımlı olmalıdır.
2. Satıcı, panelde kendi kanal bilgilerini girer; secret değerler API'den geri dönmez.
3. Ticimax'ta mağaza URL'si + Web Servis Üye Kodu bağlanır; ürün eşlemesinde
   resmi servisin istediği barkod ve varyasyon ID birlikte girilir.
4. Ticimax Webhook Yönetimi'nde hedef URL `/api/webhooks/ticimax?token=<secret>`
   olarak tanımlanır. Aynı olay ikinci kez gelirse idempotency kaydı stok düşümünü tekrar ettirmez.
5. `0063` ve `0064` migration'ları uygulandıktan sonra kanal panelde görünür.

## İzinli feed pilotunu doğrulama

XML/CSV/JSON bağlantısını panele almadan önce production ile aynı HTTPS,
SSRF, boyut, timeout ve parser kurallarıyla kontrol etmek için URL'yi komut
satırına yazmadan ortam değişkeniyle verin:

```bash
MERCHANT_FEED_AUTHORIZED=true \
MERCHANT_FEED_URL='https://magaza.example/izinli-feed.xml?token=secret' \
MERCHANT_FEED_FORMAT=auto \
pnpm --filter @gulumsalim/api feed:verify
```

Çıktı URL/token veya ürün içeriğini yazmaz; yalnız host, format, ürün/stok
sayıları, eşlenen alanlar ve SHA-256 özeti gösterilir. Özel kolonlar için
`MERCHANT_FEED_MAPPING_JSON` kullanılabilir. `mapping_required` sonucu exit 3,
geçersiz/erişilemeyen kaynak exit 1 döndürür. Satıcının yazılı izni olmadan
feed doğrulaması veya periyodik indirme yapılmamalıdır.

## Güvenlik
Ticimax URL'si yalnız HTTPS origin kabul eder; localhost/IP/private DNS
çözümleri ve yönlendirmeler engellenir. Dış çağrılar timeout'ludur. Stok olayları
satır kilidi, fencing token, tekrar deneme ve benzersiz varyasyon eşlemesiyle işlenir.
