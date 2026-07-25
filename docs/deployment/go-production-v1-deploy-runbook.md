# Go Production v1 — Clean Replacement Deploy Runbook

**Branch:** `release/go-production-v1` · **DEPLOY YOK** — açık "deploy et" onayı olmadan çalıştırılmaz.
Eski legacy sistem (`/opt/gulumsalim/app`, 33-migration) **temiz replacement ile değiştirilir**; korunması gereken gerçek veri yok (vendor_earnings=0, payouts=0, ödemeler iyzico sandbox).

`<PROD_HOST>` = deploy.sh'taki sunucu IP'si. Secret/parola bu dokümanda YOK.

## Ön koşullar
- Go 1.26.x (server: 1.26.5 ✓), Node 20+ (server: 22 ✓), pnpm 9.15 ✓.
- Artifact: `release/go-production-v1` kaynak tarball (junk hariç), sha256 BUILD_INFO'da.
- Env dosyaları sunucuda hazır (`.env` — 14 API değişkeni, bkz. PRE-DEPLOY raporu).

## FAZ 8.1 — Backup (deploy'dan ÖNCE, ZORUNLU)
```bash
ssh root@<PROD_HOST> '
  mkdir -p /root/backups/$(date +%F-%H%M) && cd /root/backups/$(date +%F-%H%M)
  # 1) Eski DB güvenlik snapshot (drop ETMEDEN önce)
  sudo -u postgres pg_dump -Fc gulumsalim > gulumsalim-legacy.dump
  # 2) Eski artifact
  tar czf app-legacy.tgz -C /opt/gulumsalim app
  # 3) nginx + systemd + env (izinler korunur)
  cp -a /etc/nginx/conf.d /root/backups/$(date +%F-%H%M)/nginx-confd 2>/dev/null || cp -a /etc/nginx nginx-etc
  cp -a /etc/systemd/system/gulumsalim-*.service .
  cp -a /opt/gulumsalim/app/apps/api/.env env-api.bak 2>/dev/null || true
  ls -lh   # yedeklerin boyutu > 0 DOĞRULA
'
```
> Yedeklerin oluştuğunu ve boyutlarının sıfır olmadığını gözle doğrula — sonraki adıma geçme.

## FAZ 8.2 — Yeni release dizini + artifact
```bash
COMMIT=<short-commit>
# Yerelden temiz artifact (deploy.sh zaten junk hariç tutuyor) veya:
scp gulumsalim-go-$COMMIT.tar.gz root@<PROD_HOST>:/tmp/
ssh root@<PROD_HOST> '
  # checksum doğrula
  echo "<SHA256>  /tmp/gulumsalim-go-'$COMMIT'.tar.gz" | sha256sum -c -
  mkdir -p /opt/gulumsalim/releases/'$COMMIT'
  tar xzf /tmp/gulumsalim-go-'$COMMIT'.tar.gz -C /opt/gulumsalim/releases/'$COMMIT'
  chown -R gulumsalim:gulumsalim /opt/gulumsalim/releases/'$COMMIT'
  cd /opt/gulumsalim/releases/'$COMMIT'
  sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm install --frozen-lockfile
  sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin pnpm --filter @gulumsalim/web build
  cd services/discovery
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -o discovery ./cmd/server
  # (opsiyonel, önerilir) go vet ./... && go test -race ./...
'
```
Env: yeni release `apps/api/.env`, `apps/web/.env.local`, `services/discovery/.env` — eski env'den kopyala (izin 600).

## FAZ 8.3 — Temiz DB (kanonik 20-migration şema)
Eski DB 33-migration; yeni sistem 20-migration ve **drizzle-kit check: OK**. Gerçek veri olmadığından temiz kurulum:
```bash
ssh root@<PROD_HOST> '
  # (Backup FAZ 8.1 alındı.) Temiz DB:
  sudo -u postgres psql -c "ALTER DATABASE gulumsalim RENAME TO gulumsalim_legacy;"   # veya DROP (yedek var)
  sudo -u postgres psql -c "CREATE DATABASE gulumsalim OWNER gulumsalim;"
  cd /opt/gulumsalim/releases/'$COMMIT'/apps/api
  sudo -u gulumsalim env $(cat .env | xargs) pnpm db:migrate      # 20 migration
  # seed (test):
  sudo -u gulumsalim env $(cat .env | xargs) pnpm db:seed:admin   # env-driven admin
  sudo -u gulumsalim env $(cat .env | xargs) pnpm db:seed:categories
'
```
> Migration'lar ileri-yönlü; rollback = `DROP DATABASE gulumsalim; ALTER DATABASE gulumsalim_legacy RENAME TO gulumsalim;`

## FAZ 8.4 — systemd + nginx (yedekten sonra)
- **systemd:** hardened unit'leri `current` symlink'e göre güncelle (`WorkingDirectory=/opt/gulumsalim/current/...`, `ExecStart=/opt/gulumsalim/current/...`). Kopyala → `systemctl daemon-reload`.
- **nginx:** production TLS (certbot 443) KORUNUR; yalnız güvenlik header'ları + HSTS + unknown-Host 444 eklenir (mevcut server bloğuna). `nginx -t` başarılı olMADAN reload etme.

## FAZ 8.5 — Atomik switch
```bash
ssh root@<PROD_HOST> '
  ln -sfn /opt/gulumsalim/releases/'$COMMIT' /opt/gulumsalim/current
  # (uploads kalıcı: /opt/gulumsalim/uploads ayrı, release'e bağlı değil)
'
```

## FAZ 8.6 — Feature flags (ilk deploy)
`apps/api/.env`:
```
DISCOVER_V1_ENABLED=false
DISCOVER_V1_ROLLOUT_PERCENT=0
DISCOVER_V1_CUSTOMER_ALLOWLIST=
DISCOVER_V1_ANONYMOUS_ENABLED=false
```
Sistem tamamı **legacy recommendation fallback** ile kalkar. (Not: mevcut kodda flag yalnız `DISCOVER_V1_ENABLED` route'u açar; allowlist/percent alanları FAZ sonrası eklenecek — bkz. PRE-DEPLOY açık riskler.)

## FAZ 8.7 — Kontrollü başlatma + health
```bash
systemctl restart gulumsalim-discovery && curl -sf 127.0.0.1:8081/readyz
systemctl restart gulumsalim-api && curl -sf 127.0.0.1:3000/healthz
systemctl restart gulumsalim-web && curl -sf 127.0.0.1:3001/
nginx -t && systemctl reload nginx
```
Her servis sonrası health OK olmadan sonrakine geçme.

## FAZ 8.8 — Smoke test
Dış HTTPS ana sayfa 200 · `/healthz` 200 · discovery `/readyz` 200 · login (rate-limit; XFF spoof regression) · public ürün gezme · checkout **gerçek charge çekmeden** (sandbox) · legacy `/discover` fallback · (allowlist test hesabı) `/v1/discover` · loglarda secret/PII yok.

## Rollback
```bash
# Kod: symlink'i eski artifact'e döndür (veya legacy /opt/gulumsalim/app)
ln -sfn /opt/gulumsalim/releases/<prev> /opt/gulumsalim/current   # veya eski app'e
systemctl restart gulumsalim-api gulumsalim-web gulumsalim-discovery
# DB: DROP DATABASE gulumsalim; ALTER DATABASE gulumsalim_legacy RENAME TO gulumsalim;
#     (veya: gunzip'siz pg_restore -d gulumsalim gulumsalim-legacy.dump)
# nginx: eski config geri + nginx -t + reload
# Discover: DISCOVER_V1_ENABLED=false + restart (anında)
```

## Incident stop conditions
5xx artışı · checkout/payment hata · discovery timeout · restart storm · health/readiness fail · conversion/empty-feed anomali → deploy durdur + rollback.
