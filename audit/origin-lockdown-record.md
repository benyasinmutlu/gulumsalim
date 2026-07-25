# Origin Lockdown + Redeploy — Completion Record

**Tarih:** 2026-07-25 · **Karar: ORIGIN LOCKDOWN COMPLETED** · Bağımsız harici istemciyle doğrulandı.

## Uygulanan (production, doğrulandı, kalıcı)
- **Firewall (firewalld):** `cloudflare4`(15 v4)+`cloudflare6`(7 v6) ipset → yalnız CF'den 80/443 (4 rich-rule). Geniş `http/https` + kullanılmayan `cockpit` servisleri kaldırıldı → aktif: `dhcpv6-client ssh`. Reboot-safe (permanent).
- **nginx real-IP:** `/etc/nginx/snippets/cloudflare-realip.conf` (22 CF CIDR) + `real_ip_header CF-Connecting-IP` + `real_ip_recursive on`; proxy XFF `$remote_addr`'e sabitlendi. → request.ip = gerçek istemci (spoof-proof), rate-limit doğru anahtarlanıyor.
- **Redeploy:** release `53b01a0` (sha256 f57345dd…) → **API bind 127.0.0.1:3000** (loopback), graceful shutdown (SIGTERM drain), discover cohort kontrolleri (flag KAPALI). Go vet/build ✓ (discovery Go 86e6b83 ile birebir → -race orada temizdi).

## Bağımsız harici doğrulama (origin dışı istemci)
| Test | Sonuç |
|---|---|
| domain via Cloudflare (/, /api/healthz, /urunler) | **200** ✅ |
| direkt origin v4:443 / v4:80 | **000 (unreachable)** ✅ |
| direkt origin v6:443 | **000** ✅ |
| direkt + sahte CF-Connecting-IP | **000 (reddedildi)** ✅ |
| servisler | active, NRestarts=0 ✅ |
| API bind | 127.0.0.1:3000 ✅ |
| health / readyz | ok / ready ✅ |

## Kod doğrulaması
Manuel `X-Forwarded-For` / `CF-Connecting-IP` parse **YOK** (yalnız yorumda); rate-limit `request.ip` (Fastify trustProxy=loopback yönetimli).

## Yedekler / rollback
- firewalld+nginx: `/root/lockdown-backup/<ts>/`; app: `/opt/gulumsalim/app.legacy.<ts>`; DB: `/root/backups/2026-07-25-142158/gulumsalim.dump` (dokunulmadı).
- Rollback: bkz. `origin-lockdown-prechange.md` §14 + `runbook.md`.

## Kalan (opsiyonel, düşük öncelik)
- certbot `renew --dry-run` inconclusive (cert Oct 2026 geçerli) → süresi dolmadan doğrula veya DNS-01'e geç.
- IPv6:443 nginx dinlemiyor (CF v6 origin-pull IPv4'e düşer; opsiyonel `listen [::]:443`).
- CF CIDR staleness → periyodik ipset güncelleme.
- Hetzner cloud firewall (panel) 1. katman olarak eklenebilir.
- API log'da gerçek istemci IP için `request.ip` açıkça loglanabilir (kozmetik).
