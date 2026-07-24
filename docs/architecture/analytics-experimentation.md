# Analytics & Experimentation Engine

## Amaç
Öneri/keşfet/try-on kalitesini ölçmek ve deneyleri (A/B) güvenli, deterministik biçimde yönetmek. Kişisel veri minimizasyonu esas.

## Kapsam dışı
- Ham PII toplama; üçüncü taraf analytics SDK'ları (self-host tercih).
- Gerçek-zamanlı streaming analytics (ilk sürüm batch/aggregate yeterli).

## Veri akışı
```
recommendation events ─▶ aggregate metrics (batch) ─▶ dashboard
experiment assignment (deterministic) ─▶ exposure event ─▶ metric by variant ─▶ guardrails
```

## Metrikler
- Öneri: impression, CTR, favorite/add-to-cart/conversion rate, revenue/session, coverage, diversity, novelty, hide/not_interested oranı, empty-result rate, latency.
- Try-on: completion rate, try-on sonrası conversion uplift.

## Trust boundary
- Event kimliği server-side; metric agregasyonu customer-level değil **event/variant-level** (minimizasyon).
- Experiment config **admin-only**; kill switch admin.

## Bileşenler (hedef)
- Metric hook noktaları (feed servis + try-on lifecycle).
- Experiment assignment: deterministic hash(experimentId + stableId) → bucket; `exposure` event; version alanı.
- Guardrail: conversion/latency düşerse otomatik uyarı + kill switch; SRM (sample ratio mismatch) kontrolü.

## API / contract
- `assign(experimentId, stableId) → variant` (deterministic, stable bucketing).
- `exposure` event: `{experimentId, version, variant, stableId(hash)}`.
- Metric event: `{name, variant?, value, ts}`.

## Failure modes
- Metric pipeline down → uygulama etkilenmez (fire-and-forget, mevcut event deseni gibi).
- Experiment config hatası → varsayılan/kontrol varyantı (fail-safe).
- SRM tespit → deney geçersiz işaretlenir.

## Privacy / security
- Veri minimizasyonu: stableId hash'lenir, ham IP/PII tutulmaz.
- Consent.analytics=false → yalnız agrege/anonim.
- Retention politikası + erişim admin-only.

## Observability
- Deney maruz kalma sayıları, guardrail durumu, metric tazelik, SRM sinyali.

## Test stratejisi
- Assignment determinizmi (aynı stableId → aynı bucket), stable bucketing, kill switch, guardrail tetikleme → unit (deterministik, saf).

## Rollout
1. Metric hook'ları (sayaç) — davranış değişmez.
2. Deterministic assignment + exposure.
3. İlk A/B: ranking v1 vs legacy, guardrail'lı.

## Rollback
- Kill switch ile deneyi kontrol varyantına sabitle (anında).

## Açık kararlar
- Metric deposu (Postgres tablo vs harici) + agregasyon periyodu.
- stableId kaynağı (customerId vs anonymousId) ve hash tuzu.
- Deney config saklama (settings tablosu vs ayrı).
