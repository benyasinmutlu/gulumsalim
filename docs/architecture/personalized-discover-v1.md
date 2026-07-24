# Personalized Discover v1

## Amaç
Müşteri ana sayfası ve "Keşfet" için uçtan uca, kişiye özel, **açıklanabilir** ve deterministik öneri pipeline'ı. Kişisel davranış + toplulaştırılmış davranış + ürün/bağlam sinyallerini birleştirir.

## Kapsam dışı (bu sürüm)
Gerçek ML/transformer, GPU, canlı DB/route bağlama, web tracking implementasyonu, devasa collaborative matrix. Bunlar interface/tasarım seviyesinde.

## Pipeline aşamaları (kod: `recommendation/discover/pipeline.ts`)
```
loadProfile + loadSeen
  → CandidateContext (consent yoksa kişisel kaynak yok)
  → gatherCandidates (4 kaynak PARALEL, graceful partial, boşsa popular fallback)
  → dedup (en yüksek rawScore, kaynak önceliği)
  → hydrate features (user×product×cross×context)
  → score = 0.7*ranker(ranking.ts) + 0.3*rawScore   [multi-stage]
  → eligibility filter (stok/yayın/satıcı/gizli/seen)
  → post-rank: sort + diversity(vendor/brand/category) + already-used
  → mix: for_you | trending | discover_new  (bölümler arası tekrar yok)
  → response (requestId, algorithmVersion, recommendationId, cursor, fallbackUsed, cacheable)
```

## Trust boundary
- `customerId` yalnız authenticated session'dan (`DiscoverRequest`); body'den değil.
- Kişiselleştirilmiş yanıt `cacheable=false` → cross-user cache leak engeli.
- Pipeline saf; DB erişimi `CatalogPort`/`CollaborativePort` ardında.

## Bileşenler
- `contract.ts` — response tipleri, cursor codec, recommendationId, experimentBucket, ALGORITHM_VERSION.
- `candidates.ts` — CandidateSource + 4 kaynak + collaborative + dedup + gather.
- `pipeline.ts` — orkestrasyon + hydration + scoring + diversity + mixer.
- `ranking.ts` — açıklanabilir weighted score (yeniden kullanıldı).
- `profile.ts` — incremental profil + idempotent merge.
- `event-security.ts` — event doğrulama.

## API / contract
`GET /v1/discover?limit&cursor&surface` (tasarım). Response: `{ requestId, algorithmVersion, sections[{key,title,items[{productId,recommendationId,reasonCode,score,source}]}], cursor, fallbackUsed, cacheable }`. Discovery yalnız ID + metadata; detay ana API'de hydrate.

## Failure modes
Kaynak hatası → izole (allSettled). Tüm kaynak boş → popular fallback. Silinmiş/stoksuz ürün → eligibility eler. Profil yok → cold-start (trend+keşif). Bozuk cursor → offset 0. **Ana sayfa asla 500 vermez** (fallback zinciri).

## Privacy / security
Consent yoksa kişisel kaynak/profil yok. Seen suppression + hidden filtreleme. recommendationId hash; PII yok. Detay: `recommendation-privacy-threat-model.md`.

## Observability
`perSourceCounts`, `fallbackUsed`, aday/filtre sayıları, section item sayıları. Metrikler: `recommendation-experiment-plan.md`.

## Test stratejisi
Saf/port-tabanlı → deterministik unit. Kapsanan: determinizm, out-of-stock/deleted/hidden/seen filtre, diversity, anonim, consent, cacheable, cursor, fallback, dedup, event abuse, profil merge (116 test toplam).

## Rollout
1. Slice interface/test seviyesinde (bu tur — tamam).
2. `/v1/discover` route + PG/Redis adapter (feature flag arkasında).
3. A/B: control=legacy discovery, treatment=discover-v1.
4. Web tracking + kademeli %.

## Rollback
Feature flag `legacy` → mevcut Go `/discover` sırası. Pipeline additive; Go servisi değişmedi → geri alma risksiz.

## Açık kararlar
- `/v1/discover` route sahibi (apps/api) + adapter'lar.
- Profil deposu (Redis vs PG) + retention.
- Collaborative aggregate'in gerçek üretimi (batch job).
- v1 ağırlıklarının A/B ile ayarlanması.
