# Claude Opus — Komut & İnceleme Günlüğü

**Branch:** `review/claude-opus` · **Tarih:** 2026-07-24 · **Ortam:** win32, Go toolchain YOK.

## Aşama 0 — Kurulum & haritalama
- `ls -la`, `git status/log/branch`, `git worktree list` → repo kökü, tek commit `38cb008`, branch `main`.
- `git checkout -b review/claude-opus` → inceleme branch'i.
- `find services/ infra/` → discovery ve infra dosya envanteri.
- `git ls-files | sed 's#/.*##' | uniq -c` → top-level tracked: `go`(1394, module cache!), `app`(487, ikiz ağaç), `apps`(340), `infra`(52), `.config`(21), `services`(14) + home dotfile'ları.
- Kanoniklik doğrulaması: `deploy.sh` (`.` paketler, `/opt/gulumsalim/app`'e açar), systemd (`WorkingDirectory=/opt/gulumsalim/app/{apps,services}`), `drizzle.config.ts` (`out: ../../infra/postgres/migrations`) → **top-level authoritative**. `app/` deploy edilmez (CLAUDE-010).

## Aşama 1-2 — Discovery (Go) statik inceleme
- `Read` × tüm dosyalar: main.go, router.go, handlers/{discover,health}.go, config.go, ingest/{consumer,decay,events}.go, scoring/score.go, store/{postgres,redis}.go, go.mod.
- Bulgular: HTTP timeout yok (004), consumer koşulsuz XAck (003), unstable sort (011), Redis TTL/prune yok (009), decay lost-update (016), panic recovery yok (015), timing-unsafe secret (014), readiness yok (023), per-user authz yok (017).
- Pozitif: parametreli SQL (SQLi yok), 127.0.0.1 bind, secret startup validation, SCAN (KEYS değil), stream MAXLEN 500000.

## Aşama 3 — PostgreSQL & migration
- `grep` para/tip/constraint taraması + `Read` 0000_known_tigra.sql.
- `grep 'DROP|CONCURRENTLY|deleted_at|CHECK|NOT NULL'` tüm migration'lar → tehlikeli op yok, NOT NULL eklemeleri DEFAULT'lu, soft-delete yok, veri-migration yok.
- Bulgular: CHECK constraint yok (005), eksik customer_id FK (018), no-action FK + anonimleştirme yok (019), IBAN/banka PII düz metin (020). Para `numeric(10,2)` ✓.

## Aşama 4 — nginx / systemd / deploy / secrets / trust boundary
- `Read` nginx/systemd × 4 / deploy.sh.
- Bulgular: TLS yok (001), güvenlik header yok (007), Host injection (006), XFF spoof (013), uploads ham servis (008), deploy non-atomik/root/non-frozen (002), systemd hardening eksik (012).
- Secret taraması: `.env.example` placeholder (`changeme`), `.env` git'te YOK, `.config`/dotfile'larda gerçek uygulama secret'ı YOK (Meilisearch master key yok). → CLAUDE-021 hijyen, secret sızıntısı değil.
- Trust boundary: `emitBehavioralEvent` çağıranları (`cart/catalog.routes.ts`, `checkout.service.ts`) `customerId`'yi `request.session.customerId`/`order.customerId`'den alır → forge edilemez ✓. `discovery.client.ts` secret'i env'den, userId'yi session'dan geçirir ✓.

## Uygulanan düzeltmeler (kod)
| Dosya | Değişiklik | Bulgu |
|---|---|---|
| `cmd/server/main.go` | HTTP timeout'ları | 004 |
| `internal/api/router.go` | ConstantTimeCompare + /readyz route | 014, 023 |
| `internal/api/handlers/health.go` | Readyz (pg+redis ping) | 023 |
| `internal/ingest/consumer.go` | handleMessage error dönüşü, koşullu XAck, panic recover | 003, 015 |
| `internal/ingest/decay.go` | runDecayOnce + panic recover | 015 |
| `internal/store/redis.go` | affinity TTL (Expire) + decay prune (ZRem) | 009 |
| `internal/scoring/score.go` | SliceStable + tie-breaker | 011 |
| `internal/scoring/score_test.go` | determinizm + vendor cap testleri | 011 |
| `internal/ingest/events_test.go` | parse/allowlist testleri | — |
| `infra/nginx/gulumsalim.conf` | güvenlik header, default_server 444, uploads CSP, proxy timeout | 006,007,008 |
| `infra/systemd/*.service` × 4 | sandbox hardening + StartLimit + ReadWritePaths | 012 |
| `infra/scripts/deploy.sh` | set -Eeuo, --frozen-lockfile, tar exclude, migration notu | 002 |

> **DOĞRULANMADI:** Go değişiklikleri derlenmedi (toolchain yok); nginx/systemd canlı test edilmedi (sunucu erişimi yok, destructive test yapılmadı). Doğrulama komutları `infra-release-checklist.md §0-2`.
