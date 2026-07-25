# Gülüm Şalım — Operations Runbook

Kanonik ağaç: **`app/`** (33 migration). Sunucu: Hetzner VPS · AlmaLinux 10.2 · `<PROD_HOST>` (deploy.sh'ta). Site Cloudflare arkasında (edge → origin nginx → API).
`<PROD_HOST>`, secret ve parola bu dokümanda **maskeli/yok**. SSH read-only keşif dışında her yazma işlemi onaylı olmalı.

## Servis haritası
| Servis | Port (bind) | systemd | Rol |
|---|---|---|---|
| API (Fastify) | 3000 | `gulumsalim-api` | REST, auth, ödeme, admin/satıcı |
| Web (Next.js) | 3001 | `gulumsalim-web` | SSR/ISR vitrin |
| Discovery (Go) | 8081 (127.0.0.1) | `gulumsalim-discovery` | davranışsal event + keşfet |
| Meilisearch | 7700 (127.0.0.1) | `meilisearch` | arama |
| PostgreSQL | 5432 (127.0.0.1) | `postgresql` | veri |
| Valkey/Redis | 6379 (127.0.0.1) | `valkey` | session + affinity + stream |
| nginx | 80/443 | `nginx` | reverse proxy + TLS (Let's Encrypt) |

Kod dizini: `/opt/gulumsalim/app` → symlink → `/opt/gulumsalim/releases/<commit>`. Uploads: `/opt/gulumsalim/uploads` (kalıcı, release'ten bağımsız).

## Health / readiness endpoint'leri
```bash
curl 127.0.0.1:3000/healthz     # {"status":"ok","checks":{"database":true,"redis":true}}
curl 127.0.0.1:8081/healthz     # discovery liveness
curl 127.0.0.1:8081/readyz      # discovery readiness (pg+redis ping) → 503 bağımlılık düşükse
curl 127.0.0.1:3001/            # web
curl -I https://ylina.life/     # dış (Cloudflare→origin), 200 + güvenlik header'ları
```

## Log konumları
- Tüm servisler: `journalctl -u gulumsalim-api|gulumsalim-web|gulumsalim-discovery -f`
- Son hatalar: `journalctl -u gulumsalim-api -p err --since "1 hour ago"`
- nginx: `/var/log/nginx/` (access/error) · API/Web: pino JSON stdout → journald (structured, reqId dahil)
- **PII/secret loglama YOK** — log'da token/cookie/parola görürsen sızıntı olarak raporla, kopyalama.

## Deployment (yeni release)
> Kod git kullanmıyor (artifact deploy). Kaynak: kanonik `app/` ağacından tarball.
```bash
# 0) yerelde: artifact + checksum
tar czf gulumsalim-app-<commit>.tar.gz -C app --exclude=node_modules --exclude=.next --exclude=.git --exclude='*/.env*' .
sha256sum gulumsalim-app-<commit>.tar.gz
# 1) BACKUP (aşağıdaki "Backup" bölümü) — ZORUNLU
# 2) upload + checksum doğrula + extract
scp gulumsalim-app-<commit>.tar.gz root@<PROD_HOST>:/tmp/
ssh root@<PROD_HOST> 'echo "<sha>  /tmp/gulumsalim-app-<commit>.tar.gz" | sha256sum -c -'
ssh root@<PROD_HOST> 'mkdir -p /opt/gulumsalim/releases/<commit> && tar xzf /tmp/gulumsalim-app-<commit>.tar.gz -C /opt/gulumsalim/releases/<commit>'
# 3) env kopyala (eski release'ten) + install + build + Go doğrula
ssh root@<PROD_HOST> 'R=/opt/gulumsalim/releases/<commit>
  cp -a /opt/gulumsalim/app/apps/api/.env $R/apps/api/.env
  cp -a /opt/gulumsalim/app/apps/web/.env.local $R/apps/web/.env.local
  cp -a /opt/gulumsalim/app/services/discovery/.env $R/services/discovery/.env
  chown -R gulumsalim:gulumsalim $R
  cd $R && sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim pnpm install --frozen-lockfile
  sudo -u gulumsalim env PATH=/usr/local/bin:/usr/bin:/bin HOME=/opt/gulumsalim pnpm --filter @gulumsalim/web build
  cd services/discovery
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go vet ./... && \
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go test -race ./... && \
  sudo -u gulumsalim env PATH=/usr/local/go/bin:/usr/bin:/bin HOME=/opt/gulumsalim go build -buildvcs=false -o discovery ./cmd/server'
# 4) ATOMIK SWITCH (DB'ye dokunma — şema zaten 33)
ssh root@<PROD_HOST> 'mv /opt/gulumsalim/app /opt/gulumsalim/app.legacy.$(date +%s)
  ln -sfn /opt/gulumsalim/releases/<commit> /opt/gulumsalim/app
  systemctl restart gulumsalim-discovery && curl -sf 127.0.0.1:8081/readyz
  systemctl restart gulumsalim-api && curl -sf 127.0.0.1:3000/healthz
  systemctl restart gulumsalim-web && curl -sf 127.0.0.1:3001/'
# 5) smoke (aşağı) + dış HTTPS 200 doğrula
```
> Go build **`-buildvcs=false`** şart (release dizininde .git yok).

## Rollback
```bash
ssh root@<PROD_HOST> 'rm -f /opt/gulumsalim/app
  mv /opt/gulumsalim/app.legacy.<ts> /opt/gulumsalim/app   # veya önceki releases/<commit>'e symlink
  systemctl restart gulumsalim-discovery gulumsalim-api gulumsalim-web'
```
DB'ye dokunulmadıysa DB rollback gerekmez. Migration çalıştıysa: `pg_restore` ile son dump'a dön (aşağı).

## Restart (tek servis)
```bash
systemctl restart gulumsalim-api        # veya -web / -discovery
systemctl status gulumsalim-api --no-pager
# API graceful shutdown destekler (SIGTERM → in-flight tamamlanır → kapanır).
```

## Backup
```bash
TS=$(date +%F-%H%M%S); BK=/root/backups/$TS; mkdir -p $BK
sudo -u postgres pg_dump -Fc gulumsalim > $BK/gulumsalim.dump      # DB (custom format)
tar czf $BK/app.tgz -C /opt/gulumsalim app                          # kod
cp -a /etc/systemd/system/gulumsalim-*.service $BK/                 # unit'ler
cp -a /etc/nginx/conf.d/gulumsalim.conf $BK/                        # nginx
tar czf $BK/uploads.tgz -C /opt/gulumsalim uploads                 # yüklenen görseller
ls -lh $BK   # her dosya boyutu > 0 DOĞRULA
```

## Restore
```bash
# DB (dikkat: mevcut veriyi değiştirir — önce yedek/rename):
sudo -u postgres psql -c "ALTER DATABASE gulumsalim RENAME TO gulumsalim_broken;"
sudo -u postgres psql -c "CREATE DATABASE gulumsalim OWNER gulumsalim;"
sudo -u postgres pg_restore -d gulumsalim /root/backups/<ts>/gulumsalim.dump
# uploads: tar xzf /root/backups/<ts>/uploads.tgz -C /opt/gulumsalim
```

## Smoke tests (deploy sonrası)
```bash
curl -sI https://ylina.life/            # 200 + HSTS/X-Frame-Options/nosniff
curl -s  https://ylina.life/urunler     # ürün gezme 200
curl -s  https://ylina.life/api/healthz # 200
curl -s  127.0.0.1:8081/readyz          # ready
# login rate-limit: aynı IP'den >10 hatalı /api/auth/login → 429 (yeni oturumda)
# checkout: yalnız iyzico SANDBOX ile; gerçek charge çekme
# forgot-password: POST /api/auth/forgot-password (CSRF token ile) → 200
# refund akışı: admin panelden test siparişinde
```

## Discover v1 rollout
Flag'ler `apps/api/.env` (varsayılan hepsi kapalı → herkes legacy):
```
DISCOVER_V1_ENABLED=false            # global kill switch
DISCOVER_V1_ROLLOUT_PERCENT=0        # 0-100 deterministic (authenticated)
DISCOVER_V1_CUSTOMER_ALLOWLIST=      # virgüllü müşteri ID'leri
DISCOVER_V1_ANONYMOUS_ENABLED=false  # anonim ayrı flag
```
**Açılış sırası (önerilen):**
1. `DISCOVER_V1_ENABLED=true` + `DISCOVER_V1_CUSTOMER_ALLOWLIST=<test-hesabı-id>` → `systemctl restart gulumsalim-api`.
2. Yalnız o hesapta `/api/v1/discover` doğrula (cohort dışı → boş fallback, web legacy'ye düşer).
3. Sorun yoksa `DISCOVER_V1_ROLLOUT_PERCENT` 1 → 5 → 25 → 50 → 100 kademeli.
4. Anonim ayrı: `DISCOVER_V1_ANONYMOUS_ENABLED=true` (ayrı karar).

### Emergency disable (Discover)
```bash
sed -i 's/DISCOVER_V1_ENABLED=true/DISCOVER_V1_ENABLED=false/' /opt/gulumsalim/app/apps/api/.env
systemctl restart gulumsalim-api    # anında herkes legacy'ye döner
```

## Payment troubleshooting
- **Callback "başarısız" ama iyzico'da ödendi:** log'da `Ödeme sağlayıcı sonucu bekleyen siparişle eşleşmedi` → callback tutar/token siparişle eşleşmiyor. `orders` tablosunda `payment_ref`, `subtotal`, `total` ile iyzico sonucunu (retrieveCheckoutForm) karşılaştır. Tutar farkı = fiyat değişmiş sipariş.
- **Sipariş "pending" kaldı:** iyzico callback gelmemiş veya init başarısız. `payment_ref` null ise init başarısız (log: `PaymentInitError`). Kullanıcı yeniden denemeli.
- **Çift satın-alma event'i:** olmamalı — `markOrderPaid` koşullu (pending→paid), tek geçiş. Görülürse migration/deploy tutarsızlığı kontrol et.
- **Stok tutarsızlığı:** stok varyant seviyesinde, siparişte koşullu düşülür; iade/iptalde `restoreOrderItemStock` tek sefer. Negatif stok görülürse (constraint yoksa) `productVariants.stock` denetle.
- iyzico anahtarları `apps/api/.env` (`IYZICO_*`) — canlıya geçişte sandbox'tan canlıya çevir + gerçek TC Kimlik toplama ekle.

## Common failures
| Belirti | Muhtemel neden | Aksiyon |
|---|---|---|
| `/healthz` 503 | DB veya Redis down | `systemctl status postgresql valkey`; bağlantı/oturum sayısı |
| `/readyz` 503 (discovery) | pg/redis ping başarısız | aynı; discovery restart |
| api restart loop | env eksik/hatalı (zod boot-parse) | `journalctl -u gulumsalim-api` → eksik env; StartLimit devreye girer |
| 5xx artışı | upstream (api/web) hata | ilgili servisin logu; gerekirse rollback |
| Redis bellek baskısı | affinity/session birikimi | `maxmemory=600mb volatile-lru` (ayarlı); INFO memory |
| nginx reload başarısız | config hatası | `nginx -t` (reload etmez); backup config'e dön |
| disk dolması | journal/uploads/release birikimi | eski `releases/*` ve `app.legacy.*` temizle; `journalctl --vacuum-size=200M` |

## Bakım notları
- Eski release dizinleri (`/opt/gulumsalim/releases/*`) ve `app.legacy.*` birikir → periyodik temizle (son 2-3 sürümü tut).
- Journal: `journalctl --vacuum-size=200M` (veya `/etc/systemd/journald.conf` `SystemMaxUse=200M`).
- TLS: certbot otomatik yeniler (Let's Encrypt); `certbot certificates` ile kontrol.
- CHECK constraint'ler `NOT VALID` — düşük trafikte `VALIDATE CONSTRAINT` ile tamamlanabilir.
