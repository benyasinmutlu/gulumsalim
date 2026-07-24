# Personalized Discover — Guarded Rollout Plan

**DEPLOY YOK** — bu plan hazırdır, açık onay olmadan çalıştırılmaz. Gerçek production keşfine dayanır (`audit/production-readonly-discovery.md`).

## Ön koşul (P0 — deploy'dan ÖNCE)
- **Kanonik ağaç reconcile.** Production 33-migration + `packages/`; güvenlik/discover işi top-level 20-migration ağaçta. Önce fix'ler kanonik ağaca taşınmalı (`production-deployment-gap.md` P0-1). Bu yapılmadan deploy ETME.

## Adımlar
1. **Backup / snapshot.**
   - DB: `sudo -u postgres pg_dump gulumsalim | gzip > /root/backups/gulumsalim-$(date +%F-%H%M).sql.gz` (deploy öncesi ZORUNLU — down migration yok).
   - Artifact: mevcut `/opt/gulumsalim/app`'i tar'la (`tar czf /root/backups/app-$(date +%F-%H%M).tgz -C /opt/gulumsalim app`) — git yok, rollback için tek yol.
   - nginx/systemd: `/etc/nginx` ve `/etc/systemd/system/gulumsalim-*.service` kopyaları.
2. **Current tag/commit.** Kanonik repo'da deploy edilecek commit'i tag'le (`prod-YYYYMMDD`). Artifact hash kaydı.
3. **Staging / shadow validation.** Ayrı staging'de (aynı 33-migration şema) tüm testler + smoke. Canlıya dokunmadan.
4. **Build.** `pnpm install --frozen-lockfile` → `pnpm --filter web build` → API `tsc --noEmit`.
5. **Go build/test/race** (Go 1.26.5 prod'da mevcut): `cd services/discovery && go build ./... && go vet ./... && go test -race ./...`. Yeşil olmadan devam etme.
6. **Migration dry-run.** Yeni migration varsa (CHECK constraint = `manual/0001`) önce detection query; `NOT VALID` ekle, düşük trafikte `VALIDATE`. Şema zaten 33; yalnız additive constraint.
7. **Deploy (atomik).** Fix'lenmiş `deploy.sh` (frozen-lockfile + exclude). Tercihen release-dir + symlink swap (atomik); mevcut yerinde-üzeri deploy riskli.
8. **Health/readiness.** `curl 127.0.0.1:3000/healthz`=200, `:8081/readyz`=200 (yeni), `:3001`=200.
9. **Smoke.** Login (rate-limit), checkout başlat (fiyat sunucuda), `/discover` ve (flag açıksa) `/v1/discover`, admin/vendor guard.
10. **Feature flag control.** `DISCOVER_V1_ENABLED` başlangıçta KAPALI. Diğer güvenlik fix'leri flag'siz (davranış-koruyucu).
11. **%1 treatment.** `/v1/discover`'ı experiment ile %1'e aç (control=legacy `/discover`).
12. **Metric guardrails.** latency, empty-feed, fallback-rate, conversion. Bozulma → durdur.
13. **Kademeli.** %5 → %25 → %50 → %100, her adımda guardrail.
14. **nginx hardening.** Güvenlik header'ları + HSTS (TLS zaten var) + unknown-Host 444. `nginx -t` → reload.
15. **systemd hardening.** Sandbox unit'leri kopyala → `daemon-reload` → restart → `systemd-analyze security`.
16. **Rollback komutları.**
    - Kod: `tar xzf /root/backups/app-<ts>.tgz -C /opt/gulumsalim && systemctl restart gulumsalim-*`.
    - DB: `gunzip -c /root/backups/gulumsalim-<ts>.sql.gz | sudo -u postgres psql gulumsalim` (yeni-yıkıcı migration varsa; additive constraint için `DROP CONSTRAINT`).
    - nginx: eski config'i geri koy → `nginx -t && systemctl reload nginx`.
    - Flag: `DISCOVER_V1_ENABLED=false` + restart (anında).
17. **Incident stop conditions.** 5xx artışı, checkout/payment hata artışı, discovery timeout, restart storm, conversion düşüşü, empty-feed artışı → deploy durdur + rollback.

## Güvenlik notları
- Gerçek IP/domain deploy anında doldurulur (`gulumsalim.prod-tls.conf.template`).
- Secret dosyaları (`.env`, EnvironmentFile) `chmod 600`, git'te değil.
- Prod'da `DISCOVER_V1_ENABLED` yalnız canlı DB doğrulaması + %1 A/B guardrail'dan sonra %100.
