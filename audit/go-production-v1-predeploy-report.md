# PRE-DEPLOY Report — Go Production v1

**Tarih:** 2026-07-25 · **Karar: READY FOR CLEAN DEPLOY (onay bekliyor)** · **Production'a HİÇBİR yazma yapılmadı.**

Strateji: serverdaki legacy `app/` (33-migration) eski test kurulumu; korunacak gerçek veri yok. GitHub Go monorepo temiz replacement olarak deploy edilir.

| # | Konu | Sonuç |
|---|---|---|
| 1 | **Source-of-truth branch** | `release/go-production-v1` (taban: `feature/personalized-discover-integration`; backup: `backup/before-go-production-v1`) — remote'a push'landı |
| 2 | **Dahil commitler** | Tüm güvenlik + discover commit'leri doğrulandı (11/11 ✓): order/checkout hardening, auth/session/rate-limit, trustProxy, payment-callback tests, discovery timeouts, nginx hardening, candidate pipeline, scoring, event-security, /v1/discover route, runtime adapters |
| 3 | **Güvenlik fix matrisi** | trustProxy=`loopback` ✓ · login rate-limit ✓ · session.regenerate ✓ · vendor session guard ✓ · checkout server-side price ✓ · callback token+amount(BigInt) ✓ · idempotency ✓ · koşullu stok ✓ · Go timeouts/panic/XAck/const-time/ranking/TTL/`/readyz` ✓ · nginx/systemd hardening kaynakları ✓ |
| 4 | **Discover bileşenleri** | candidate sources + scoring + eligibility + diversity + mixer + contract + event-security + profile + runtime adapters + `GET /v1/discover` (flag-gated) + typed web client + impression tracker |
| 5 | **Aktif migration ağacı** | top-level `infra/postgres/migrations` — **20 migration (0000-0019)**, `drizzle-kit check: OK` (şema.ts tutarlı; brand/view_count hem kodda hem migration'da) |
| 6 | **Node test/typecheck/build** | `pnpm install --frozen` ✓ · API `tsc` 0 · Web `tsc` 0 · **125 test / 18 dosya** ✓ · **Web `next build` 0** ✓ |
| 7 | **Go test/vet/race/build** | ⚠️ **Yerelde çalıştırılamadı (Go yok)**. Server'da Go 1.26.5 var → **CI/staging'de zorunlu**: `go build ./... && go vet ./... && go test -race ./...`. Kod statik incelendi (prior). |
| 8 | **nginx/systemd doğrulaması** | `deploy.sh` `bash -n` ✓. nginx/systemd araçları yerelde yok → sunucuda reload ÖNCESİ `nginx -t` + `systemd-analyze verify` (runbook). |
| 9 | **Release artifact** | `gulumsalim-go-8d5cb14.tar.gz` (temiz kaynak, junk hariç), **506K** |
| 10 | **SHA-256** | `b520a757b3471c6e2eb75776bbbca704e5234b09a113b5b7453c984a49d2d245` |
| 11 | **Gerekli env değişkenleri** | API (14): `NODE_ENV, PORT, DATABASE_URL, REDIS_URL, SESSION_SECRET, MEILISEARCH_URL, MEILISEARCH_API_KEY, DISCOVERY_SERVICE_URL, DISCOVERY_SERVICE_SECRET, IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_BASE_URL, SITE_URL, UPLOADS_DIR` + (opsiyonel) `DISCOVER_V1_ENABLED`. Web: `API_URL/SITE_ORIGIN`. **Değerler yazılmadı.** |
| 12 | **Eski DB gerçek veri?** | **YOK.** orders: 8 pending + 1 paid (iyzico **sandbox**), payment_ref 7 (sandbox token), **vendor_earnings=0, payouts=0** (gerçek para hareketi yok), 9 test müşterisi, uploads 40 dosya/12M test görseli. |
| 13 | **Temiz DB planı** | Legacy'yi rename/snapshot → yeni `gulumsalim` DB → 20 migration (`pnpm db:migrate`) → seed admin/categories. Runbook FAZ 8.3. |
| 14 | **Backup komutları** | `pg_dump -Fc` + artifact `tar` + nginx/systemd/env kopyaları. Runbook FAZ 8.1 (boyut>0 doğrula). |
| 15 | **Replacement deploy komutları** | `releases/<commit>` + pnpm install/build + go build + `current` symlink swap. Runbook FAZ 8.2-8.5. |
| 16 | **Rollback komutları** | symlink→önceki + `DROP/RENAME` DB + nginx eski config + `DISCOVER_V1_ENABLED=false`. Runbook Rollback. |
| 17 | **Smoke test listesi** | HTTPS 200 · health/readyz · login+XFF regression · ürün gezme · sandbox checkout · legacy fallback · allowlist `/v1/discover` · log secret/PII yok. Runbook FAZ 8.8. |
| 18 | **Açık riskler** | aşağıda |

## Açık riskler / notlar
- **P0 — Go doğrulaması yerelde yapılamadı:** `go build/-race` CI veya staging'de (Go 1.26.x) koşulmalı; deploy'da sunucuda `go build` zaten var, öncesinde `go test -race` önerilir.
- **P1 — Feature flag kapsamı:** Mevcut kodda yalnız `DISCOVER_V1_ENABLED` (route on/off) + deterministic `experimentBucket` var. Plandaki `DISCOVER_V1_ROLLOUT_PERCENT / CUSTOMER_ALLOWLIST / ANONYMOUS_ENABLED` **henüz kod değil**. İlk deploy: `DISCOVER_V1_ENABLED=false` (herkes legacy). Allowlist-only rollout için flag mantığı sonraki küçük PR'da eklenmeli.
- **P1 — nginx/systemd path'leri:** Hardened config'ler `/opt/gulumsalim/app/...` yollu; release-dir + `current` symlink için `/opt/gulumsalim/current/...`'a güncellenmeli (runbook). nginx TLS (certbot) KORUNUR, yalnız header/HSTS eklenir.
- **P2 — API bind 0.0.0.0:3000** (firewalld dış erişimi bloke ediyor) → `127.0.0.1`'e bind önerilir.
- **P2 — Repo hijyeni:** legacy `app/`, `go/`, `.config` hâlâ branch'te (tracked); `deploy.sh` artifact'tan hariç tutuyor → deploy'a sızmaz. İleride `git rm` önerilir (blocker değil).
- **Bilgi:** production `packages/shared-contracts` kod tarafından import edilmiyor → Go monorepo deploy'unda gerekmez.

## Karar: **READY FOR CLEAN DEPLOY**
Go tabanlı sistem tek source-of-truth; temiz build + tutarlı 20-migration şema + 125 test + web build yeşil; geri-alınabilir replacement planı hazır; Discover v1 varsayılan KAPALI; collaborative engine kapalı. **Açık yazılı "deploy et" onayı bekleniyor** — onay gelene kadar production'a hiçbir yazma yapılmaz. Tek şart: Go `build/-race` CI/staging'de yeşil olmalı.
