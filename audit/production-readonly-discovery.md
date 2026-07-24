# Production Read-Only Discovery

**Tarih:** 2026-07-25 · **Erişim:** salt-okunur SSH (root, parola `.env`'den — **hiçbir yere yazılmadı**).
**PRODUCTION'DA HİÇBİR DEĞİŞİKLİK YAPILMADI** — yalnız okuma/GET/SELECT. Kırmızı çizgilerin hiçbiri geçilmedi.
**Secret/PII yok:** parola maskelendi; DB'de yalnız agregat/metadata (satır içeriği okunmadı); host/IP repo'da zaten mevcut (deploy.sh).

## Bağlanılan makine
- Hostname: `gulumsalim` · Host: `<PROD_HOST>` (deploy.sh'taki IP) · Kullanıcı: root
- OS: AlmaLinux 10.2 (Lavender Lion), kernel 6.12 · Uptime 7 gün · Disk / 75G %13 · RAM 3.5Gi (~597Mi free)

## Çalışan servisler (systemd — hepsi active/running, NRestarts=0)
`gulumsalim-api`, `gulumsalim-web`, `gulumsalim-discovery`, `meilisearch`, `nginx`, `postgresql`, `valkey`.
- WorkingDirectory'ler: `/opt/gulumsalim/app/{apps/api, apps/web, services/discovery}` (User=gulumsalim).

## Deploy yöntemi / çalışan artifact
- **Artifact deploy** — `/opt/gulumsalim/app`'te **`.git` YOK**. Çalışan commit belirlenemedi (git'siz tar artifact).
- Artifact yaşı: `package.json` mtime **2026-07-19**, discovery binary **2026-07-21**.
- **Server tree:** `apps/ packages/ docs/ dumps/ infra/ services/ node_modules/` — **`packages/` içerir** (local top-level'de YOK), `go/`/`.config`/`app/` gibi local junk YOK.
- **Sonuç:** Deploy edilen ağaç, local `38cb008` reposunun **top-level'i DEĞİL**. Şema seviyesi (aşağıda) local `app/` alt-ağacına (33 migration) uyuyor ama `packages/` ile birlikte → production, local repo'nun tam karşılığı değil. Bkz. `production-deployment-gap.md`.

## Runtime
Node **v22.23.1** · pnpm **9.15.0** · Go **1.26.5** (kurulu → Go build/test/-race **yapılabilir**; blocker "Go yok" değil).

## Ağ / portlar
| Port | Bind | Not |
|---|---|---|
| 80, 443 | 0.0.0.0 | nginx (public) |
| **3000** | **0.0.0.0** | **API tüm interface'lerde** — firewalld dış erişimi bloke ediyor (aşağıda) ama 127.0.0.1 olmalı (defense-in-depth) |
| 3001, 8081, 7700, 5432, 6379 | 127.0.0.1 | web, discovery, meili, postgres, valkey — doğru (loopback) |
- **Firewall (firewalld active):** allowed services = `cockpit http https ssh`. **3000 açık DEĞİL** → API internete kapalı (dış test `:3000/healthz` = `000`). `cockpit` (9090) internete açık — ek saldırı yüzeyi (not).
- Dış test: `https://<PROD_HOST>/` = **200** (TLS çalışıyor); `http://<PROD_HOST>:3000` = erişilemez (firewalld).

## TLS gerçek durumu
- **TLS AKTİF** (repo config'i :80-only olsa da). nginx 1.26.3, `listen 443 ssl # managed by Certbot`, HTTP→HTTPS `return 301`.
- Sertifika: **Let's Encrypt** (issuer YE1), CN=`ylina.life`, geçerli **Oct 16 2026**'ya kadar. → **CLAUDE-001 (TLS) production'da ÇÖZÜLMÜŞ.**
- **EKSİK:** güvenlik header'ları (`X-Content-Type-Options`, `X-Frame-Options`, **HSTS**) nginx'te YOK; unknown-Host `return 444` yerine https redirect. → CLAUDE-007 hâlâ gerekli.
- X-Forwarded-For: `$proxy_add_x_forwarded_for` (repo aslıyla aynı) — backend `trustProxy` fix'i deploy edilmediğinden CLAUDE-013 bypass'ı prod'da **canlı**.

## systemd
- Unit'ler `/etc/systemd/system/`. User=gulumsalim. Sandbox hardening (ProtectHome/RestrictAddressFamilies/StartLimit vb.) **deploy edilmemiş** (repo'daki fix prod'da yok).

## Veritabanı (read-only; yalnız agregat/metadata)
- DB `gulumsalim`. Migration tablosu `drizzle.__drizzle_migrations` = **33 uygulanmış migration**.
- Şema drift markerları: `products.brand`=VAR, `products.view_count`=VAR, `refund_status` type=VAR, `promo_banner_clicks` tablosu=VAR (62 satır). → **Production 33-migration şeması** (local `app/` ağacı), top-level `infra` (20) DEĞİL.
- **CHECK constraint (`chk_%`) = 0** → para/stok DB guard'ları (CLAUDE-005) YOK.
- 38 public tablo. Approx satır: products=14, promo_banner_clicks=62, product_images=19, categories=11, customers=8, order_items=8, orders=7. **Küçük/erken veri** → collaborative sinyal henüz anlamsız.

## Redis / Valkey
- Valkey **8.0.7** (redis protokol 7.2.4). used_memory **1.73M**. **maxmemory=0 (limitsiz), policy=noeviction** → büyürse eviction yerine OOM (CLAUDE-009 ile ilgili risk). db0: 316 key / 303 TTL'li (TTL uygulanıyor — iyi).

## Health / readiness
- `api /healthz` = **200** · `web :3001` = **200** · `discovery /healthz` = **200** · **`discovery /readyz` = 404** → readiness fix'i (CLAUDE-023) deploy edilmemiş.

## Loglar (bounded, son hatalar)
- `gulumsalim-api`, `gulumsalim-discovery`, `nginx`: **son hata kaydı YOK**. Servisler stabil (NRestarts=0). PII/secret log'a rastlanmadı.

## Erişilemeyen / yapılmayan (bilinçli)
- Çalışan commit (git yok). `.env` değer içeriği (yalnız değişken isimleri). DB satır/PII içeriği. Go build (prod'da dosya yazmamak için çalıştırılmadı — Go mevcut, CI/staging'de koşulmalı). Herhangi bir write/restart/reload/migration.
