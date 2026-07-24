# Recommendation Experiment Plan (FAZ 7)

## Metrikler (minimum)
Latency (request), aday sayısı/kaynak (`perSourceCounts`), filtrelenen aday, fallback rate, empty-feed rate, impression, CTR, favorite rate, add-to-cart rate, purchase conversion, revenue/session, hide/not-interested rate, diversity, novelty, coverage.

## Guardrail'lar
Conversion ve latency düşüşü → uyarı + kill switch. Sample ratio mismatch (SRM) kontrolü. Empty-feed / fallback rate artışı → uyarı.

## Deney altyapısı (kod: `discover/contract.ts` `experimentBucket`)
- **Deterministik assignment**: `experimentBucket(experimentId, stableId, 100)` = SHA-256 tabanlı stabil bucket. Aynı stableId → aynı bucket (test edildi).
- **Stable bucketing**: stableId = customerId (giriş) veya anonymousId (anonim).
- **Exposure event**: `{experimentId, version, variant, stableId(hash)}` — yalnız feed gerçekten gösterildiğinde.
- **Versioning**: `algorithmVersion` her response'ta.

## İlk deney
- **control** = legacy (mevcut Go `/discover` sırası).
- **treatment** = discover-v1 (yeni pipeline).
- Assignment: `experimentBucket("discover-v1", stableId) < 50` → treatment.
- Primary metrik: add-to-cart + purchase conversion. Guardrail: latency, empty-feed.
- Kill switch: flag → herkesi control'e sabitle (anında).

## Impression doğruluğu (web, FAZ 5)
- Impression yalnız **viewport'a gerçekten girince** (IntersectionObserver) — render ≠ impression.
- Aynı recommendation aynı oturumda tekrar tekrar loglanmaz (dedup).
- Click event `recommendationId` taşır (hangi öneri tıklandı).

## Bu tur kapsamı
Config + contract seviyesi (deterministik bucketing + exposure şeması). Admin UI YOK (gerekli değil). Metric toplama hook'ları tasarım; gerçek depo bağlanmadı.

## Açık kararlar
- Metric deposu (PG tablo vs harici) + agregasyon periyodu.
- stableId hash tuzu.
- Deney config saklama (settings tablosu).
