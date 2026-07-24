# Intelligent Commerce Engine Roadmap

Bu doküman, motorların kademeli ve ölçülebilir yol haritasını P0–P4 önceliklendirmesiyle özetler. Detay: her motorun kendi dokümanı.

## Prensipler
- Çalışan sistemi bozma; additive + feature-flag'li ilerle.
- Her adımda: contract → skeleton (test) → gölge → A/B → kademeli.
- Gizlilik odaklı; rıza ve minimizasyon baştan.

## P0 — Launch blocker (motor öncesi)
- **TLS** (CLAUDE-001) — fotoğraf/rıza/ödeme HTTPS şart.
- **Migration drift** kararı (CLAUDE-010, `migration-drift-decision.md`).
- **Staging ödeme E2E** (canlı Postgres/Redis + iyzico sandbox).
- **Go build/test/-race** (Go toolchain'li CI).
- **Backup/restore** testi + para CHECK constraint'leri (`manual/0001`).

## P1 — Güvenli personalization (BAŞLADI)
| Öğe | Durum |
|---|---|
| Versioned event contract | ✅ `event-contract.ts` (+test) |
| Consent + anonymous-session | ✅ contract'ta |
| Dedup/idempotency | ✅ `deriveDedupKey` |
| Scoring açık arayüz + v1 | ✅ `ranking.ts` (skeleton, +test) |
| Explanation | ✅ `FeatureContribution` |
| Feature flag legacy/v1 | ✅ `selectRankingStrategy` |
| Source adapter + fallback | ✅ `source-adapter.ts` |
| Metric hook'ları | ⏳ tasarım (analytics doc) |
| Event contract'ı emit yoluna bağlama (Go tarafı) | ⏳ sonraki tur |

## P2 — Kombin motoru (BAŞLADI)
| Öğe | Durum |
|---|---|
| Garment domain + kural arayüzü | ✅ `outfit/contract.ts` (+test) |
| Renk uyumu + slot tamamlama + açıklama | ✅ skeleton |
| **Ürün metadata alanları** (renk/mevsim/stil...) | ⏳ şema migration gerekli |
| Satın-alma-birlikteliği, embedding | ⏳ P4 |

## P3 — Virtual try-on (CONTRACT AŞAMASI)
| Öğe | Durum |
|---|---|
| Job lifecycle + adapter + mock | ✅ `try-on/contract.ts` (+test) |
| Upload validation contract | ✅ `validateUploadDescriptor` |
| Private storage + bounded queue + izole worker | ⏳ tasarım |
| 2D warp prototip, sınırlı beta | ⏳ |
| Privacy design (rıza/retention/silme) | ⏳ `privacy-threat-model.md` |

## P4 — Gelişmiş modelleme
- Embeddings, görsel uyum, learning-to-rank, GPU try-on, fraud-aware ranking.

## Fraud/abuse & quality (yatay)
- Sinyal modeli: event spam, fake impression/click, seller/review manipülasyonu, bot, upload abuse, promo abuse, payment callback anomali, ATO. Bu turda **yalnız sinyal + güvenli entegrasyon noktası**; otomatik engelleme YOK.

## Bu turda uygulananlar (özet)
- 4 yeni TS modülü + 41 yeni unit test (event contract, ranking, source adapter, try-on, outfit). Tümü typecheck + test geçti. Go/servis kodu bu turda değişmedi (design-level).

## Bu turda YAPILMAYANLAR (bilinçli)
Gerçek AI entegrasyonu, prod fotoğraf upload, kalıcı foto saklama, model eğitimi, GPU altyapısı, DB yeniden tasarımı, discovery'nin değiştirilmesi, test edilmemiş refactor.
