# Candidate Sources

Retrieval katmanı — ranking'den ayrı (X prensibi). Her kaynak `CandidateSource` arayüzünü uygular ve DB'den `CatalogPort`/`CollaborativePort` ile decouple. Kod: `recommendation/discover/candidates.ts`.

## Standart arayüz
`Candidate { productId, vendorId, source, rawScore(0..1), reason, version, generatedAt }`.

## Kaynaklar
| Kaynak | X karşılığı | Girdi | Üretim | reason |
|---|---|---|---|---|
| `personal_history` | in-network | profil top kategoriler | `productsByCategories` | because_you_viewed |
| `collaborative` | social proof | son etkileşilen ürünler | `alsoInteracted` (co-view/cart/purchase) | people_also_viewed |
| `trending` | popularity | — | `trending` (conversion-adjusted) | trending_now |
| `exploration` | out-of-network | bilinmeyen marka | `newArrivals` \ knownBrands | discover_new_brand |
| `popular_fallback` | safety net | — | `trending` | popular |

## Kurallar
- **Graceful partial**: kaynaklar `Promise.allSettled` ile paralel; biri patlarsa diğerleri devam (izolasyon). Prod'da her kaynak timeout ile sarılır.
- **Fallback**: tüm kaynaklar boşsa `popular_fallback` (feed asla boş kalmaz).
- **Dedup**: aynı productId → en yüksek rawScore; eşitlikte kaynak önceliği (personal>collab>trending>exploration>fallback).
- **Collaborative güvenlik**: minimum support threshold, tek-kullanıcı sinyali görünmez, düşük örneklemde kullanma, bot/spam sınırlama, purchase>cart>favorite>view, zaman decay, popülerlik bias normalizasyonu — IMPLEMENTASYONDA (aggregate job) zorlanır; bu tur interface + in-memory test.

## Collaborative aggregate (tasarım, bu tur interface)
- Yapı: `product_pair_stats(product_a, product_b, co_view, co_cart, co_purchase, support, updated_at)` — batch job ile doldurulur (mevcut migration düzenini bozmadan ayrı tablo).
- Redis alternatifi: `co:view:<productId>` sorted set (TTL). Min support altındakiler yayınlanmaz.
- Bu turda **sahte production davranışı yazılmadı**; `CollaborativePort` + in-memory test impl var.

## Test
`candidates.test.ts` — dedup önceliği, kaynak izolasyonu (hata), tüm-boş → fallback.
