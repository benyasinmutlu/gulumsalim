# Handoff → ChatGPT 5.6 (apps/api, apps/web, auth, ödeme, iş mantığı)

Claude Opus (infra/Go reviewer) tarafından, senin alanına giren ama ilk 2 saatte
BENİM değiştirmediğim bulgular. Kod yolları doğrulandı; her madde eyleme dönük.
Discovery/infra tarafındaki karşılıkları `claude-findings.md`'de.

> Ben yalnızca `services/discovery`, `infra/` (nginx/systemd/deploy/migration) dosyalarını değiştirdim. `apps/**` altında **hiçbir değişiklik yapmadım**.

---

## H-01 (→ CLAUDE-005) — Para/miktar doğrulaması: negatif tutar & DB CHECK'leri
- **Nerede:** `apps/api/src/modules/orders/checkout.service.ts`, satıcı payout mantığı, sepet miktar güncelleme (`cart.service.ts`).
- **Ne kontrol et:** Sipariş toplamı/`unit_price`/`total` ve payout `amount` **tamamen server-side** hesaplanıyor mu, yoksa request body'den geliyor mu? `quantity` için `> 0`, tutarlar için `>= 0` doğrulaması var mı? Zod şemalarında `.positive()`/`.nonnegative()` var mı?
- **Neden:** DB seviyesinde CHECK constraint YOK (bkz. 0000 migration). Uygulama guard'ı tek savunma. Bypass edilirse negatif payout → cüzdan bakiyesi şişer.
- **Koordinasyon:** Ben `00NN_money_checks.sql` migration taslağını `infra-release-checklist.md`'ye koydum. Uygulama iş kuralın (iade/kredi negatif tutar kullanıyor mu?) ile çelişmediğini teyit et, sonra birlikte uygulayalım (son entegrasyon aşamasında).

## H-02 (→ CLAUDE-008) — Upload MIME doğrulaması / stored XSS
- **Nerede:** `apps/api` upload handler (`@fastify/multipart` kullanan route; muhtemelen ürün görseli & satıcı logo).
- **Ne kontrol et:** Yüklenen dosyanın gerçek içerik-tipi allowlist'e (jpeg/png/webp) göre doğrulanıyor mu? Uzantı/`Content-Type` header'ına mı güveniliyor? `sharp` ile yeniden-encode ediliyor mu (metadata + aktif içerik temizler)?
- **Neden:** `/uploads/` nginx'ten aynı-origin ham servis ediliyor. HTML/SVG yüklenebiliyorsa stored XSS → oturum çalma. nginx tarafına `Content-Security-Policy: default-src 'none'; sandbox` palyatifi ekledim ama asıl düzeltme upload doğrulaması + sharp re-encode.

## H-03 (→ CLAUDE-013) — Fastify `trustProxy` ve XFF parse
- **Nerede:** `apps/api/src/app.ts` / server kurulumu; rate-limit ve IP loglama.
- **Ne kontrol et:** Fastify `trustProxy` ayarı ne? Rate-limit / audit / fraud kontrolü `request.ip`'yi kullanıyorsa, tek güvenilen proxy (nginx, 127.0.0.1) mı sayılıyor yoksa XFF zinciri körlemesine mi parse ediliyor? `trustProxy: true` (hepsine güven) YANLIŞ olur — istemci XFF spoof edip rate-limit/IP allowlist atlatır.
- **Neden:** nginx `$proxy_add_x_forwarded_for` istemci XFF'ini koruyor. Ben nginx'te BUNU DEĞİŞTİRMEDİM çünkü doğru düzeltme backend'in trustProxy config'ine bağlı. Öneri: `trustProxy: '127.0.0.1'` (yalnızca nginx).

## H-04 (→ CLAUDE-006) — Host header'a güven (mutlak URL üretimi)
- **Nerede:** Parola sıfırlama / e-posta linkleri, kanonik SSR URL (`apps/web`), varsa `SITE_URL` yerine `Host` kullanımı.
- **Ne kontrol et:** Mutlak URL üretilirken `request.headers.host` mı yoksa sabit `env.SITE_URL` mi kullanılıyor? Host'a güveniliyorsa host-header injection → zehirli parola-sıfırlama linki.
- **Neden:** nginx'e bilinmeyen Host reddi (default_server 444) ekledim ama meşru vhost içinde de app `SITE_URL` kullanmalı, `Host`'a değil.

## H-05 (genel, öncelik yüksek) — Ödeme (iyzico) webhook/callback güvenliği
- **Nerede:** `apps/api/src/modules/orders/checkout.service.ts` ve iyzico callback route'u.
- **Ne kontrol et:** iyzico ödeme sonucu callback'i **imza/hash doğrulaması** yapıyor mu? Ödeme "başarılı" durumu istemciden mi yoksa iyzico'ya server-to-server sorgulanarak mı teyit ediliyor? Tutar, iyzico'nun döndürdüğü tutarla eşleşiyor mu (client-supplied amount'a güvenilmiyor mu)? Idempotency (aynı callback iki kez → çift kredi) var mı?
- **Neden:** Bu senin çekirdek alanın; benim bulgu değil ama en yüksek para-riski burada. `payment_ref`/`order_number` unique constraint var (iyi), ama callback doğrulaması kod tarafında.

## H-06 (genel) — Session çerezi & CSRF & CORS konfig teyidi
- **Nerede:** `apps/api/src/app.ts` / plugins (`@fastify/session`, `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/cors` bağımlılıkları mevcut).
- **Ne kontrol et:** Session çerezi `httpOnly:true`, `sameSite:'lax'|'strict'`, `secure:true` (TLS gelince — CLAUDE-001) mi? CSRF koruması state-changing route'larda gerçekten aktif mi yoksa sadece kurulu mu? CORS `origin` allowlist mi yoksa `*`/yansıtma mı? `SESSION_SECRET` min-32 doğrulaması `env.ts`'te var mı?
- **Neden:** Bağımlılıklar var ama config'i ben doğrulamadım — senin alanın. TLS yokken `secure:true` çerezi kırar, o yüzden CLAUDE-001 ile sıralı gitmeli.

---

### İkinci-dikiş için: `gpt56-findings.md` hazır olunca haber ver
Son 45-60 dk'da senin Critical/High bulgularını adversarial doğrulayıp her biri için
Confirmed / Confirmed-revised / Duplicate / Not-reproducible / False-positive /
Fixed-but-incomplete / Fixed-and-verified kararı vereceğim (özellikle authz/IDOR,
ödeme tutarı/webhook, mass-assignment, transaction yarışları, SSR/ISR cache sızıntısı
ve eklediğin regression testlerinin gerçekten açığı yakalayıp yakalamadığı).
