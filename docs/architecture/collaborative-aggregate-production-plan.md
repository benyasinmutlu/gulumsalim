# Collaborative Aggregate — Production Plan (Karar Dokümanı)

**DEĞİL bu turda kod.** Yalnız karar/gereksinim. Gerçek production gözlemine dayanır (`audit/production-readonly-discovery.md`).

## Production gerçekliği (ölçülen)
- **Veri çok küçük:** ~14 ürün, 8 müşteri, 7 sipariş, 8 order_item, 62 promo_banner_click. Davranış event stream'i (`events:behavioral`) düşük hacim (Valkey 316 key, 1.73M).
- **Sonuç:** Collaborative sinyal (co-view/co-cart/co-purchase) için **istatistiksel destek YOK**. Bu ölçekte co-occurrence gürültüden ibaret olur ve tek-kullanıcı davranışını ifşa eder (gizlilik riski).

## Karar
**Şimdi collaborative aggregate KURMA.** `CollaborativePort` boş bırakılır (pipeline diğer kaynak + fallback'e düşer). Aşağıdaki eşikler sağlanınca yeniden değerlendir.

## Tetik eşikleri (bunlar sağlanmadan başlama)
- ≥ ~5.000 sipariş VEYA ≥ ~50.000 davranış event (aylık), ve
- ürün başına anlamlı co-occurrence (min support ≥ 20 ortak kullanıcı).

## Gerçekleştiğinde tasarım
| Konu | Karar |
|---|---|
| Kaynak | `events:behavioral` stream + `orders/order_items` (co-purchase) |
| Batch vs streaming | **Batch** (gecelik) — real-time gerekmez, basit + denetlenebilir |
| Yapı | PG tablo `product_pair_stats(product_a, product_b, co_view, co_cart, co_purchase, support, updated_at)` — **additive migration** (mevcut 33'ü bozmadan) |
| Cardinality riski | Pair sayısı O(ürün²) → yalnız top-K komşu sakla (ürün başına ≤ 50), support eşiği altındakileri at |
| Minimum support | co-purchase ≥ 5, co-view ≥ 20 (tek-kullanıcı ifşasını önler) |
| Privacy threshold | k-anonimlik: support < eşik olan çift **yayınlanmaz** (inference engeli) |
| Decay | zaman-ağırlıklı (son 90 gün); eski etkileşim söner |
| Bot filtreleme | aynı customer tekrarlı event ağırlıklandırılmaz; hız-anomali hariç |
| Ağırlık | purchase > cart > favorite > view; iade/iptal → co-purchase düzeltmesi |
| Depo | PG tablo (aggregate) + opsiyonel Redis cache (`co:<productId>` ZSET, TTL) |
| Retention | pair_stats gecelik yeniden hesap; ham event MAXLEN'e tabi |
| Backfill | ilk çalıştırmada tüm geçmiş order/event'ten tek seferlik hesap |
| Idempotency | gecelik job idempotent (tam yeniden hesap veya upsert) |
| Migration | 1 additive tablo + index (`product_a, support desc`) |
| Operasyonel maliyet | gecelik batch (dakikalar), düşük; Redis cache MB seviyesi |

## Entegrasyon noktası (hazır)
`recommendation/discover/candidates.ts` `CollaborativePort.alsoInteracted(seedIds, limit)` — production adapter bu tabloyu okur; min-support filtreleme adapter içinde zorlanır. Interface + in-memory test zaten mevcut.

> Gerçek production verisi olmadan hacim/sayı **uydurulmadı**; yukarıdaki eşikler sektör-genel başlangıç değerleridir, gerçek trafik biriktikçe kalibre edilir.
