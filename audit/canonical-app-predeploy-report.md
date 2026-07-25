# PRE-DEPLOY Report — Canonical app/ (Go Monorepo)

**Tarih:** 2026-07-25 · **Karar: READY FOR DEPLOY APPROVAL** · **Production'a HİÇBİR yazma yapılmadı.**
`<PROD_HOST>` = deploy.sh'taki sunucu IP'si. Secret/PII yok.

| # | Konu | Sonuç |
|---|---|---|
| 1 | **Reconcile branch / HEAD** | `release/production-canonical-reconcile` — remote'ta; HEAD bu commit |
| 2 | **Canonical source tree** | **`app/`** (33 migration, tüm gelişmiş özellikler) — kesin source of truth |
| 3 | **Ödeme port kararı** | **PAYMENT PORT VERIFIED** — callback token+amount (BigInt) doğrulaması, koşullu race-safe transition, pending-guard; server-side price + koşullu stok zaten vardı |
| 4 | **Refund regresyon** | ✅ **regresyon yok** — customer/admin refund dosyalarına dokunulmadı; markOrderPaymentFailed pending-guard ile iyileşti (bkz. feature-regression-matrix) |
| 5 | **Korunan gelişmiş özellikler** | forgot/reset password, SMTP mailer, customer+admin refund, 2.el/individual seller, site feedback, vendor complaints, shipping, vendor categories, 33-migration şema — **hepsi ✓** |
| 6 | **Discover port sonucu** | ✅ tam stack app/'e port (candidate sources→ranking→eligibility→diversity→mixer→contract→event-security→profile→adapters→`/v1/discover`) |
| 7 | **Feature flag davranışı** | `DISCOVER_V1_ENABLED=false` → route kayıtsız, herkes legacy. `true` → `/v1/discover` açık. `ROLLOUT_PERCENT/ALLOWLIST/ANONYMOUS` alanları **henüz kod değil** (P1) — ilk açılış allowlist yerine tek test hesabıyla manuel doğrulanır |
| 8 | **Migration sonucu** | 33-migration **KORUNDU**; prod DB zaten 33 → **DB reset/wipe YOK**, kod deploy edilir. (Opsiyonel additive: `manual/0001` money/stock CHECK) |
| 9 | **Test sayısı** | app/ **114 test / 16 dosya** ✅ (baseline 4'ten); feature+payment+discover regresyonlarıyla arttı |
| 10 | **API/Web build** | API `tsc` 0 · Web `tsc` 0 · **Web `next build` 0** ✅ |
| 11 | **Go vet/test/race/build** | ⚠️ **yerelde yok** → deploy sırasında sunucuda `go build` + öncesi `go vet ./... && go test -race ./...` (Go 1.26.5) — **onaylı deploy'da çalıştırılacak** |
| 12 | **nginx/systemd doğrulaması** | `deploy.sh` `bash -n` ✓. nginx/systemd sunucuda reload öncesi `nginx -t` + `systemd-analyze verify` |
| 13 | **Artifact adı** | `gulumsalim-app-<short>.tar.gz` (**644K**, junk hariç) |
| 14 | **SHA-256** | `74018729799f2e6cc1ad6f7a701d50ed795009ab50829ee891a24c9b65eca6e5` |
| 15 | **Backup komutları** | `pg_dump -Fc gulumsalim` + `tar` app + nginx/systemd/env kopyaları (boyut>0 doğrula) |
| 16 | **DB dump** | `sudo -u postgres pg_dump -Fc gulumsalim > /root/backups/<ts>/gulumsalim.dump` (deploy ÖNCESİ) |
| 17 | **Deploy komutları** | release-dir + pnpm install/build + go build + `current` symlink swap (DB dokunulmaz) |
| 18 | **Rollback komutları** | symlink→önceki release + restart; DB'ye dokunulmadığı için DB rollback gerekmez (yedek yine de var) |
| 19 | **Smoke test planı** | HTTPS 200 · /healthz · /readyz · login+XFF regression · ürün gezme · **forgot-password** · **refund** · **2.el listing** · sandbox checkout callback · legacy discover · allowlist /v1/discover · log secret/PII yok |
| 20 | **Açık riskler** | aşağıda |

## Deploy komutları (onay sonrası — çalıştırılmadı)
```bash
COMMIT=<short>; TS=$(date +%F-%H%M)
ssh root@<PROD_HOST> '
  # 1) BACKUP
  mkdir -p /root/backups/'$TS' && cd /root/backups/'$TS'
  sudo -u postgres pg_dump -Fc gulumsalim > gulumsalim.dump
  tar czf app-legacy.tgz -C /opt/gulumsalim app
  cp -a /etc/systemd/system/gulumsalim-*.service . ; ls -lh   # boyut>0 doğrula
'
scp gulumsalim-app-$COMMIT.tar.gz root@<PROD_HOST>:/tmp/
ssh root@<PROD_HOST> '
  echo "74018729...  /tmp/gulumsalim-app-'$COMMIT'.tar.gz" | sha256sum -c -
  mkdir -p /opt/gulumsalim/releases/'$COMMIT'
  tar xzf /tmp/gulumsalim-app-'$COMMIT'.tar.gz -C /opt/gulumsalim/releases/'$COMMIT'
  chown -R gulumsalim:gulumsalim /opt/gulumsalim/releases/'$COMMIT'
  # env kopyala (eski release'ten, izin 600 korunur)
  cp -a /opt/gulumsalim/app/apps/api/.env /opt/gulumsalim/releases/'$COMMIT'/apps/api/.env
  cp -a /opt/gulumsalim/app/apps/web/.env.local /opt/gulumsalim/releases/'$COMMIT'/apps/web/.env.local 2>/dev/null || true
  cp -a /opt/gulumsalim/app/services/discovery/.env /opt/gulumsalim/releases/'$COMMIT'/services/discovery/.env
  cd /opt/gulumsalim/releases/'$COMMIT'
  sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm install --frozen-lockfile
  sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm --filter @gulumsalim/web build
  cd services/discovery
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go vet ./... && \
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go test -race ./... && \
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -o discovery ./cmd/server
'
# ATOMIK SWITCH + restart (DB dokunulmaz — zaten 33-migration)
ssh root@<PROD_HOST> '
  ln -sfn /opt/gulumsalim/releases/'$COMMIT' /opt/gulumsalim/current
  # systemd unit path'lerini current'e çevir (WorkingDirectory/ExecStart) — bkz. runbook
  systemctl daemon-reload
  systemctl restart gulumsalim-discovery && curl -sf 127.0.0.1:8081/readyz
  systemctl restart gulumsalim-api && curl -sf 127.0.0.1:3000/healthz
  systemctl restart gulumsalim-web && curl -sf 127.0.0.1:3001/
  nginx -t && systemctl reload nginx
'
```
## Rollback
```bash
ssh root@<PROD_HOST> 'ln -sfn /opt/gulumsalim/app /opt/gulumsalim/current; systemctl restart gulumsalim-*'
# DB'ye dokunulmadı → DB rollback gerekmez (yedek yine mevcut).
```

## Açık riskler
- **P0 — Go `-race`:** deploy içinde sunucuda koşulacak; yeşil olmazsa switch YAPILMAZ.
- **P1 — Feature flag kapsamı:** yalnız `DISCOVER_V1_ENABLED`; percent/allowlist/anonymous alanları sonraki küçük PR. İlk açılış: flag ON + tek test hesabıyla manuel doğrulama, sonra kapat.
- **P1 — systemd path'leri:** `current` symlink için `WorkingDirectory/ExecStart` güncellenmeli.
- **P2 — nginx headers/HSTS:** prod certbot config'ine eklenmeli (`app/infra/nginx` referans); `nginx -t` sonrası.
- **P2 — order number** `GS${ts}${rand}` tahmin edilebilir (guest lookup); ileride crypto-random önerilir.
- **Bilgi:** prod DB test verisi (9 müşteri, sandbox sipariş); korunacak gerçek veri yok ama şema korunuyor.

## KARAR: **READY FOR DEPLOY APPROVAL**
app/ tek source of truth; 33-migration korundu; gelişmiş özellikler kaybolmadı (19/19 ✓); güvenlik fix'leri + Discover v1 (flag-gated) port edildi ve **114 test + web build yeşil**; artifact (644K, sha256 mevcut) geri-alınabilir; Discover v1 varsayılan KAPALI; collaborative kapalı. **Açık "deploy et" onayı bekleniyor** — Go `-race` deploy'da yeşil olması şartıyla.
