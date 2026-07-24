# Personalization Engine v1

## Amaç
Davranışsal event'lerden kişiselleştirilmiş, **açıklanabilir** ve deterministik ürün sıralaması üretmek. ML zorunlu değil; ilk sürüm ağırlıklı skorlama + feature flag.

## Kapsam dışı (bu sürüm)
- Embedding/learning-to-rank (P4).
- Gerçek-zamanlı model servisi.
- Çapraz-cihaz kimlik birleştirme (yalnız session + opsiyonel anonymousId).

## Veri akışı
```
Node API (event) ──xadd──▶ Redis Stream events:behavioral ──▶ Go discovery consumer
     │  (emitBehavioralEvent / yeni: buildRecommendationEvent)         │ affinity ZSET (TTL+decay)
     ▼                                                                 ▼
recommendation event contract (versioned)                     /discover?userId → productIds
     │                                                                 │
     └────────────── ranking v1 (apps/api) ◀── source-adapter (legacy=discovery | v1=local) ──┘
                              │ explainable RankedItem[]
                              ▼  web SSR/ISR feed
```

## Trust boundary
- Event `customerId` **daima** server-side (`request.session.customerId`) — istemci başkası adına event üretemez (mevcut güvence).
- Discovery `127.0.0.1` + shared secret (sabit-zamanlı). Redis localhost.
- `source-adapter` yalnız güvenilen discovery'yi çağırır; feed productId listesidir (PII değil).

## Bileşenler
- `analytics/event-contract.ts` — versioned event zarfı, consent, dedup.
- `services/discovery` (Go) — affinity toplama + aday havuz + mevcut skorlama.
- `recommendation/ranking.ts` — açıklanabilir v1 re-rank + feature flag.
- `recommendation/source-adapter.ts` — kaynak soyutlama + fallback.

## API / event contract
- Event: `RecommendationEvent { schemaVersion, eventId, dedupKey, type, identity{customerId?,sessionId,anonymousId?}, productId?, source, consent{personalization,analytics}, payload? }` (`RECOMMENDATION_EVENT_SCHEMA_VERSION=1`).
- Feed: `RecommendationFeed { productIds, strategy, source }`.
- Ranked: `RankedItem { productId, score, strategy, explanation: FeatureContribution[] }`.

## Failure modes
- Discovery down / boş → `withFallback` → statik/recent fallback (kullanıcı boş akış görmez).
- Redis yazma hatası → event ack'lenmez (kayıp yok, CLAUDE-003).
- Affinity yok (cold-start) → cold_start stratejisi.
- Feature flag bilinmeyen değer → `legacy` (güvenli varsayılan).

## Privacy / security
- `consent.personalization=false` → kişisel affinity'ye YAZILMAZ (`toBehavioralStreamFields` null).
- Retention: affinity ZSET 90 gün TTL + decay + prune (CLAUDE-009).
- Kullanıcı reset/delete: affinity key'leri `affinity:*:<customerId>` silinerek (bkz. roadmap görev).
- PII loglama yok; event id/dedup key hash.

## Observability
- Metric hook'ları: impression, CTR, favorite/cart/purchase rate, coverage, diversity, empty-result, latency (bkz. analytics-experimentation).
- Her feed `strategy`+`source` etiketi taşır (A/B ve hata ayıklama).

## Test stratejisi
- Ranking saf/deterministik → unit (mevcut: 12 test). Event contract → unit (10 test).
- Cold-start, boş-data, feature-flag fallback, duplicate/replay (dedupKey) kapsandı.
- Go discovery: table-driven + `-race` (CI, Go toolchain gerekli).

## Rollout
1. Event contract'ı emit yolunda gölge modda topla (davranış değişmez).
2. `RANKING_STRATEGY=v1` feature flag'ini iç kullanıcıda aç.
3. A/B: v1 vs legacy, guardrail metrikleri (conversion, latency).
4. Kademeli %.

## Rollback
- Feature flag `legacy`'ye çevir (anında, kod deploy'suz).
- Event contract additive olduğundan geri alma gerektirmez.

## Açık kararlar
- v1 ağırlıkları (`DEFAULT_V1_WEIGHTS`) A/B ile mi öğrenilecek?
- anonymousId üretimi/çerezi (gizlilik) — session ile ilişkisi.
- popularity/sellerQuality feature'larının kaynağı (event stream vs batch).
