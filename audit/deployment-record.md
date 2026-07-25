# Deployment Record — Canonical app/ → Production

**Tarih:** 2026-07-25 · **Release:** `86e6b83` (branch `release/production-canonical-reconcile`) · **Karar: CLEAN DEPLOY COMPLETED**
Production'a dağıtıldı; DB korundu; geri-alınabilir. Secret/PII yok.

## Yürütülen adımlar (hepsi doğrulandı)
| Adım | Sonuç |
|---|---|
| Backup | pg_dump 219K · app-legacy.tgz 940M · systemd/nginx/env → `/root/backups/2026-07-25-142158` |
| Artifact upload + checksum | `gulumsalim-app-86e6b83.tar.gz` sha256 `74018729…` → `sha256sum -c` OK |
| Extract → release dir | `/opt/gulumsalim/releases/86e6b83` + env kopyalandı |
| pnpm install --frozen-lockfile | OK (3.2s) |
| **go vet / test / -race** | **GEÇTİ — veri yarışı yok** (ingest+scoring) |
| go build | OK — 17M binary (`-buildvcs=false`) |
| web production build | OK — 64 sayfa, 6.7s |
| Atomik geçiş | `mv app → app.legacy.1784989753` · `ln -sfn releases/86e6b83 → app` |
| Restart + health | discovery/api/web **active, NRestarts=0** · api healthz `{db:true,redis:true}` · disc `/readyz` **200** (önceden 404) |
| Dış HTTPS smoke | ana sayfa 200 · /api/healthz 200 · /urunler 200 · /api/v1/discover 404 (flag OFF) · forgot-password 403 (CSRF aktif) |

## Üretim durumu
- Çalışan release: `readlink /opt/gulumsalim/app` → `releases/86e6b83`.
- Discover v1: **KAPALI** (`DISCOVER_V1_ENABLED` yok/false) → herkes legacy keşfet.
- TLS: Let's Encrypt (ylina.life), geçerli Eki 2026.
- DB: 33-migration şema korundu (dokunulmadı).

## Rollback (gerekirse)
```bash
ssh root@<PROD_HOST> '
  rm -f /opt/gulumsalim/app
  mv /opt/gulumsalim/app.legacy.1784989753 /opt/gulumsalim/app
  systemctl restart gulumsalim-discovery gulumsalim-api gulumsalim-web
'
# DB dokunulmadı → gerekmez. Yine de yedek: /root/backups/2026-07-25-142158/gulumsalim.dump
```

## Deploy-sonrası açık işler (opsiyonel, düşük-riskli, ayrı)
- Keşfet açılışı: allowlist flag mantığı (`ROLLOUT_PERCENT/CUSTOMER_ALLOWLIST/ANONYMOUS`) + test hesabıyla doğrulama.
- Altyapı sertleştirmesi: nginx güvenlik header'ları + HSTS, systemd sandbox, API loopback bind (prod nginx certbot-managed; header'lar ayrı eklenmeli).
- Para/stok CHECK constraint'leri (`app/infra/postgres/manual/0001`, additive).
- gofmt: artifact CRLF nedeniyle `gofmt -l` dosya listeledi (Go derliyor; kozmetik) → repoda LF normalizasyonu önerilir.
- Staging ödeme/iade E2E (gerçek iyzico-sandbox + SMTP).

## Kalıcı referanslar
- Kanonik ağaç: `app/` (source of truth). Top-level ağaç: yalnız referans/regression.
- Yedek branch'ler: `backup/before-production-canonical-reconcile`, `backup/before-go-production-v1` vb.
- PRE-DEPLOY: `audit/canonical-app-predeploy-report.md` · Feature matrix: `audit/feature-regression-matrix.md`
