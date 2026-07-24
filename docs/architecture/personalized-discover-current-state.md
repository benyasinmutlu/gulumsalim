# Personalized Discover — Mevcut Durum (FAZ 0)

Vertical slice'a başlamadan önce mevcut sistemin haritası ve FAZ 0 sorularının cevapları.

## Bileşenler
| Katman | Konum | Rol |
|---|---|---|
| Event üretimi | `apps/api/.../analytics/events.client.ts` (`emitBehavioralEvent`) | Redis stream'e yazar |
| Versioned event | `analytics/event-contract.ts` | Additive yeni sözleşme (consent/dedup) |
| Event tüketimi | `services/discovery` (Go) `internal/ingest/consumer.go` | Redis stream → affinity ZSET |
| Skorlama (mevcut) | `services/discovery/internal/scoring/score.go` | kategori/satıcı affinity + recency |
| Skorlama (yeni TS) | `recommendation/ranking.ts` | açıklanabilir v1 re-rank + flag |
| Kaynak soyutlama | `recommendation/source-adapter.ts` | legacy discovery / fallback |
| Discover pipeline (yeni) | `recommendation/discover/*` | çok-kaynaklı aday → skor → mix |
| HTTP (Go) | `discovery/internal/api` `/discover`, `/readyz` | productId listesi döner |
| API köprüsü | `apps/api/.../discovery/discovery.client.ts` | secret + session userId |

## FAZ 0 sorularının cevapları
1. **Event nerede üretiliyor?** Node API route'larında (`cart/catalog.routes.ts`, `checkout.service.ts`) — `customerId` daima session'dan.
2. **Discovery'ye nasıl ulaşıyor?** Redis Stream `events:behavioral` (`MAXLEN ~ 500000`); Go consumer XReadGroup ile tüketir.
3. **Kalıcı mı geçici mi?** Stream MAXLEN ile sınırlı (geçici); affinity ZSET 90g TTL + decay + prune (türetilmiş, yarı-kalıcı).
4. **Duplicate önleme?** Consumer XAck (yalnız başarıda — CLAUDE-003). Yeni contract `deriveDedupKey` ile idempotency; event-security batch içi dedup.
5. **Profile feature'ları nerede?** Şu an yalnız Redis affinity ZSET (kategori/satıcı). Yeni `profile.ts` incremental profili tanımlar (depolama: Redis/PG — henüz bağlanmadı).
6. **Product feature'ları nereden?** Postgres (`products/vendors`); pipeline `CatalogPort` ile decouple (prod adapter'ı PG).
7. **Discover yalnız ID mi?** Evet — Go `/discover` yalnız `productIds`+strategy döner; yeni pipeline da yalnız ID + sıralama metadata.
8. **Web hydrate?** Ana API ürün detaylarını doldurur (discovery ürün detayını bilmez).
9. **Anonymous merge?** Henüz yok; `profile.mergeAnonymousProfile` (idempotent aggregate) tanımlandı, login akışına bağlanmadı.
10. **Consent yokken?** Kişisel affinity yazılmaz (`event-contract.toBehavioralStreamFields` + `event-security.writeProfile`); pipeline consent yoksa kişisel kaynakları kullanmaz.

## Bu tur uygulanan slice (özet)
`recommendation/discover/`: `contract.ts` (response+cursor+recId+bucket), `candidates.ts` (4 kaynak + collaborative + dedup + gather), `pipeline.ts` (eligibility→hydrate→score→diversity→mix), `event-security.ts`, ve `recommendation/profile.ts`. Tümü saf/port-tabanlı → DB olmadan test edilebilir. **Go discovery servisi bu turda DEĞİŞMEDİ** (mevcut davranış korunur; TS pipeline paralel/opsiyonel katman).

## Bağlanmayan (bilinçli, DB/route gerektirir)
- Pipeline'ın gerçek `/v1/discover` route'una bağlanması + PG/Redis adapter'ları.
- Web impression/click tracking implementasyonu.
- Profile'ın Redis/PG'ye persist edilmesi.
Bunlar interface seviyesinde hazır; canlı DB olmadan sahte davranış yazılmadı.
