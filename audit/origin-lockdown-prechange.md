# PRE-CHANGE — Cloudflare Origin Lockdown + Real-IP + Küçük Redeploy

**Tarih:** 2026-07-25 · **Durum: ONAY BEKLİYOR — production'a HİÇBİR yazma yapılmadı.**
Salt-okunur inceleme tamamlandı. Aşağıdaki plan onaylanınca (açık "uygula") FAZ 8 yürütülür.

## 1. Mevcut network topology
- eth0: IPv4 `128.140.120.121/32` + **IPv6 `2a01:4f8:c015:c863::1/64`** (public).
- nginx: `listen 443 ssl` (IPv4) + `listen 80` (v4; ss'te v6:80 de var). **IPv6:443 dinlemiyor** (opsiyonel: `listen [::]:443` eklenebilir).
- API `0.0.0.0:3000`, Web `*:3001` (firewalld dışarı bloke ediyor). İç servisler (pg/valkey/meili/discovery) yalnız loopback.
- Site: DNS → **Cloudflare (proxied)** → origin nginx (Let's Encrypt) → API.

## 2. Aktif firewall teknolojisi
**firewalld** (nftables backend, `table inet firewalld`). Zone `public`/eth0, servisler: `cockpit http https ssh dhcpv6-client`. ufw/nftables-svc/docker yok. Hetzner **cloud firewall panelde** olabilir (sunucudan görünmez → önerilen 1. katman, panelden kontrol edilmeli).

## 3. Açık IPv4/IPv6 listener'lar
| Port | v4 | v6 | Servis | Not |
|---|---|---|---|---|
| 22 | ✓ | ✓ | sshd | **korunacak** |
| 80 | ✓ | ✓ | nginx | CF-only'ye kısıtlanacak (ACME de buradan) |
| 443 | ✓ | ✗ | nginx | CF-only'ye kısıtlanacak; v6:443 dinlenmiyor |
| 9090 | ✓ | ? | cockpit | firewalld izinli — **kalan risk** (ayrı kısıtlanmalı/kapatılmalı) |
| 3000/3001 | ✓ | ✓ | api/web | firewalld zaten bloke; redeploy sonrası api loopback'e döner |

## 4. Cloudflare resmi CIDR kaynağı + checksum
- Kaynak: `https://www.cloudflare.com/ips-v4` , `https://www.cloudflare.com/ips-v6` (2026-07-25 çekildi).
- **IPv4: 15 CIDR** · **IPv6: 7 CIDR** · combined_sha256 `d89bc053e3ef30a0b3f8340068b73f8b1e4c0f1047248d29f22f10dfffffb177`.
- IPv4: 173.245.48.0/20, 103.21.244.0/22, 103.22.200.0/22, 103.31.4.0/22, 141.101.64.0/18, 108.162.192.0/18, 190.93.240.0/20, 188.114.96.0/20, 197.234.240.0/22, 198.41.128.0/17, 162.158.0.0/15, 104.16.0.0/13, 104.24.0.0/14, 172.64.0.0/13, 131.0.72.0/22.
- IPv6: 2400:cb00::/32, 2606:4700::/32, 2803:f800::/32, 2405:b500::/32, 2405:8100::/32, 2a06:98c0::/29, 2c0f:f248::/32.
- **Staleness riski:** statik firewall kuralı → CF aralıkları değişirse elle güncelleme gerekir (runbook'a update yöntemi eklenecek).

## 5. Gerekli üçüncü taraf istisnaları
- **SSH (22):** korunur (kilitleme yok). · **dhcpv6-client:** korunur.
- **Ödeme callback:** `SITE_URL=https://ylina.life` → domain üzerinden (Cloudflare) → **doğrudan-IP istisnası GEREKMEZ**. iyzico checkoutForm callback'i tarayıcı POST'u (CF üzerinden).
- **ACME:** certbot **nginx (HTTP-01)** → Let's Encrypt domaine (→ Cloudflare → origin:80) vurur; **port 80 CF-only kuralı bunu kapsar** (challenge CF üzerinden geçer). Yine de `certbot renew --dry-run` ile doğrulanmalı; sağlam uzun-vade: DNS-01 (CF API token).
- **Non-CF webhook:** tespit edilmedi.
- **Cockpit (9090):** yönetim arayüzü — CF-dışı erişim gerekiyorsa admin IP allowlist, gerekmiyorsa kapatılmalı (kalan risk).

## 6. Önerilen firewall kuralları (firewalld, ipset tabanlı — güncellemesi kolay)
```bash
# ipset'ler (CF v4/v6)
firewall-cmd --permanent --new-ipset=cloudflare4 --type=hash:net --option=family=inet
for c in 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 \
 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 \
 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22; do
  firewall-cmd --permanent --ipset=cloudflare4 --add-entry=$c; done
firewall-cmd --permanent --new-ipset=cloudflare6 --type=hash:net --option=family=inet6
for c in 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32; do
  firewall-cmd --permanent --ipset=cloudflare6 --add-entry=$c; done
# yalnız CF ipset'lerinden http/https izin ver
for ips in cloudflare4 cloudflare6; do
  firewall-cmd --permanent --zone=public --add-rich-rule="rule source ipset=\"$ips\" service name=\"http\" accept"
  firewall-cmd --permanent --zone=public --add-rich-rule="rule source ipset=\"$ips\" service name=\"https\" accept"; done
# geniş http/https servislerini kaldır (ssh/cockpit/dhcpv6-client KALIR)
firewall-cmd --permanent --zone=public --remove-service=http
firewall-cmd --permanent --zone=public --remove-service=https
firewall-cmd --reload
```
> IPv4+IPv6 birlikte kapatılır (biri açık kalmaz). SSH ve cockpit dokunulmaz.

## 7. Önerilen nginx real-IP (spoof-proof)
`/etc/nginx/conf.d/gulumsalim.conf` server bloğuna (veya http bağlamına snippet):
```nginx
set_real_ip_from 173.245.48.0/20;  # ... 15 IPv4 CF CIDR
set_real_ip_from 2400:cb00::/32;    # ... 7 IPv6 CF CIDR
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```
Ve proxy başlıkları temizlenir (istemci XFF körlemesine append edilmez):
```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;   # $proxy_add_x_forwarded_for yerine
```
→ `$remote_addr` yalnız CF'den gelen `CF-Connecting-IP`'yi gerçek istemci kabul eder; doğrudan origin + sahte `CF-Connecting-IP` = güvenilmez (üstelik firewall zaten bloke eder).

## 8. Fastify trustProxy doğrulaması
Deployed kod: **`trustProxy: "loopback"`** ✅ — nginx loopback'ten proxy yapıyor, request.ip nginx'in verdiği gerçek istemci IP'si olur. **Değişiklik gerekmez.**

## 9. SSH lockout önleme
- Mevcut SSH oturumu **açık tutulur**; `ssh` servisi firewalld'de **kalır**.
- Uygulama sonrası **ikinci bağımsız SSH oturumu** ile erişim doğrulanır.
- SSH'a hiçbir kural eklenmez/kaldırılmaz.

## 10. Otomatik rollback timer
Uygulamadan hemen önce:
```bash
mkdir -p /root/fw-backup && cp -a /etc/firewalld /root/fw-backup/firewalld.$(date +%s)
# 10 dk sonra otomatik geri yükle (doğrulama başarısızsa lockout'tan kurtarır):
systemd-run --on-active=600 --unit=fw-rollback /bin/bash -c \
 'cp -a /root/fw-backup/firewalld.LATEST/* /etc/firewalld/ && firewall-cmd --reload'
# başarılı dış doğrulamadan SONRA: systemctl stop fw-rollback.timer 2>/dev/null; systemctl reset-failed fw-rollback 2>/dev/null
```

## 11. Test planı (bağımsız istemci = lokal makinem, origin DEĞİL)
| # | Test | Beklenen |
|---|---|---|
| 1 | `curl https://ylina.life/` (CF) | 200 |
| 2 | `curl https://ylina.life/api/healthz` | 200 |
| 3 | discovery readiness nginx üzerinden | beklenen |
| 4 | `curl -k https://128.140.120.121/` (direkt v4) | **başarısız/timeout** |
| 5 | `curl -k -g https://[2a01:4f8:c015:c863::1]/` (direkt v6) | **başarısız** |
| 6 | direkt origin + `Host: ylina.life` | başarısız |
| 7 | direkt origin + sahte `CF-Connecting-IP` | başarısız |
| 8 | CF üzerinden farklı IP'lerde rate-limit ayrı | ayrı sayaç |
| 9 | API logunda gerçek istemci IP | gerçek IP |
| 10 | SSH erişimi (2. oturum) | korunur |
| 11 | payment callback domain route | erişilebilir |
| 12 | `certbot renew --dry-run` | başarılı |
| 13 | unknown Host reddi | devam |
| 14 | `nginx -t` | başarılı |
| 15 | reboot sonrası kurallar kalıcı | firewalld permanent |

## 12. Redeploy edilecek commit'ler
`53b01a0` (HEAD) — şunları içerir: `ad9816d` graceful shutdown + loopback bind · `acecfbf` discover cohort kontrolleri (flag KAPALI) · `53b01a0` runbook. Yeni domain/algoritma/ödeme değişikliği YOK.

## 13. Artifact adı/checksum
`gulumsalim-app-53b01a0.tar.gz` · **645K** · sha256 `f57345dddce34e2048b6f509d43eeb097141e40beb1525405cfba82291ada8c8`.

## 14. Tam rollback komutları
```bash
# firewall:  cp -a /root/fw-backup/firewalld.<ts>/* /etc/firewalld/ && firewall-cmd --reload
# nginx:     cp /etc/nginx/conf.d/gulumsalim.conf.bak-<ts> /etc/nginx/conf.d/gulumsalim.conf && nginx -t && systemctl reload nginx
# redeploy:  rm /opt/gulumsalim/app; mv /opt/gulumsalim/app.legacy.<ts> /opt/gulumsalim/app; systemctl restart gulumsalim-*
```

## 15. Beklenen downtime
~Sıfır: firewalld reload atomik; nginx reload graceful; redeploy per-servis restart ~2-5 sn (API graceful shutdown ile bağlantı düşmez).

## 16. Kalan riskler
- **Cockpit (9090)** CF-dışı açık kalıyor → ayrı kısıtlanmalı.
- **ACME HTTP-01** CF üzerinden — `--dry-run` ile doğrulanacak; sağlamı DNS-01.
- **IPv6:443** nginx dinlemiyor (CF v6 origin-pull IPv4'e düşer; opsiyonel `listen [::]:443`).
- **CF CIDR staleness** — statik kural; güncelleme yöntemi runbook'a.
- **Hetzner cloud firewall** panelden doğrulanmalı (varsa 1. katman orada olmalı).

## Domain taşınabilirliği (domain henüz alınmadı — ek gereksinim)
- **Firewall CF-IP tabanlı** → domain değişince yeniden tasarım GEREKMEZ. ✅
- nginx `server_name ylina.life www.ylina.life` — domain değişince güncellenir (+ yeni certbot cert).
- **Domain-bağımlı env:** `SITE_URL` (API; callback + reset-password + mail linkleri buradan), web `API_URL/SITE_ORIGIN/NEXT_PUBLIC_*`, CORS `origin:true` (yansıtma, hard-code yok ✅), **cookie Domain = host-only** (set edilmiyor ✅ → koru), uploads relative `/uploads` (domain yok ✅).
- HSTS `max-age=86400`, **includeSubDomains/preload YOK** (ek gereksinim gereği). ✅
- Payment/webhook URL'leri domain değişince ayrıca güncellenir (runbook notu).
- TLS/ACME domain değişince: yeni cert (certbot) + CF origin cert; runbook'a geçiş planı.

---
**DUR.** Açık "uygula" onayı olmadan firewall/nginx/servis/artifact/Cloudflare değiştirilmeyecek.
