# Recommendation Data Flow

## Uçtan uca akış
```
[İstemci eylemi] ──▶ apps/api route (customerId = session)
   │  emitBehavioralEvent / validateClientEvent (event-security)
   ▼
Redis Stream events:behavioral (MAXLEN ~500000)
   │
   ├──▶ Go discovery consumer ──▶ affinity ZSET (TTL 90g + decay + prune)
   │                                   │
   │                                   ▼  Go /discover?userId → productIds (mevcut)
   │
   └──▶ (yeni) profile.applyEvent ──▶ CustomerProfile (Redis/PG — bağlanacak)
                                          │
[Discover isteği] ──▶ pipeline.runDiscover ◀── CatalogPort (PG) + CollaborativePort (aggregate)
   │  loadProfile + loadSeen
   ▼
sections (productId + reasonCode + recommendationId)
   │
   ▼  apps/api hydrate (ürün detayı) ──▶ web SSR/ISR feed
   │
[Impression/click] ──▶ event (recommendationId taşır) ──▶ metrics/experiments
```

## Kalıcılık
| Veri | Depo | Ömür |
|---|---|---|
| Ham event | Redis stream | MAXLEN (geçici) |
| Affinity | Redis ZSET | 90g TTL + decay |
| Profil | Redis/PG (bağlanacak) | decay + retention |
| Collaborative aggregate | PG tablo / Redis (batch) | periyodik yenilenir |
| Ürün feature | PG | canlı |

## Idempotency noktaları
- Event: `deriveDedupKey` (batch içi + store).
- Consumer XAck yalnız başarıda (kayıp yok).
- Profile merge: `mergedSessions` ile idempotent.
- Payment purchase event: yalnız güvenilir callback (sahte purchase yok).

## Trust boundary'ler
İstemci→API (session customerId) · API→Redis/PG (localhost) · API→discovery (127.0.0.1 + sabit-zamanlı secret) · kişiselleştirilmiş response cache'lenmez.

## N+1 / performans
- Aday ürün detayı tek `byIds` sorgusu (N+1 yok).
- Kaynaklar paralel, bounded pool (`limit*2`).
- Prod: kaynak başına timeout, context cancellation, graceful partial.
