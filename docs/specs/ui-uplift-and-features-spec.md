# Gülüm Şalım — UI/UX Uplift + Özellik Spec'i (memory-spec / faz planı)

> Kanonik ağaç: **`app/`**. Bu spec, kapsamlı taramanın (graphify + hedefli okuma) çıktısıdır ve
> aşamalı inşa için sözleşme niteliğindedir. **Her şey feature branch üzerinde yapılır, PR olarak
> arkadaşın review eder; sunucuya doğrudan hiçbir değişiklik gitmez.** Discover v1 KAPALI kalır.
> Log'da secret/PII yok. Prod'a yazma yok.

Tarih: 2026-07-29 · Branch: `feature/ui-uplift-and-fixes` (bu spec'ten türetilir).

---

## 0. Teknik zemin (taramadan doğrulanan gerçekler)

**Web** (`app/apps/web`):
- **Next.js 16.2.10 + React 19.2** App Router. ⚠️ `apps/web/AGENTS.md`: "This is NOT the Next.js you know" —
  kod yazmadan önce `node_modules/next/dist/docs/` okunacak (breaking changes).
- **Tailwind YOK, CSS framework YOK.** Tüm stil tek bir **116KB `globals.css`** içinde — eski
  gulumsalim.com PHP sitesinden **birebir taşınmış**. UI'ın "amatör" durmasının kök nedeni bu.
- Ancak **tasarım token'ları mevcut**: `--color-primary #C06C84` (dusty rose), `--color-secondary #6C5B7B`
  (mauve), `--color-accent #F67280`, `--color-gold #D4A574`, `--color-bg #FFF8F5`; fontlar **Outfit** (gövde) +
  **Playfair Display** (display); ikonlar FontAwesome (`<i className="fas ...">`).
- Auth sayfalarında `ga-*` tasarım sistemi (`ga-wrap`, `ga-visual`, `ga-orb`, `ga-card`, `ga-tabs`) — statik,
  animasyon/derinlik yok.
- 34 düz component (`src/components/*.tsx`), CSS Module hiç yok.
- Veri akışı: sunucu sayfaları `lib/api.ts` (SSR fetch, çerez elle taşınır); istemci `lib/client-api.ts`
  → `mutateJson` (CSRF token'lı POST/PATCH/DELETE), `uploadFile` (multipart), `fetchJson`, `ClientApiError`.

**API** (`app/apps/api`, Fastify):
- Oturum: **Redis tabanlı** (`plugins/session.ts`), çerez `gs_sid`, `httpOnly`, `secure` (prod),
  `sameSite:"lax"`, **host-only** (domain set edilmemiş — taşınabilirlik korunuyor), maxAge 30 gün.
- `trustProxy:"loopback"`, CSRF plugin, auth-guard plugin, login-rate-limit plugin.
- Mail: `lib/mailer.ts` → nodemailer SMTP, `sendMail(to, subject, html)`. (info@gulumsalim.com kutusu.)
- Yükleme: `lib/image-upload.ts` → `saveImage(subdir, buffer, mimetype)` → sharp ile WebP'ye çevirip
  **yerel diske** (`UPLOADS_DIR`) yazar, `/uploads/...` path döner. `plugins/upload.ts` (multipart, 15MB, 1 dosya).
  `modules/vendors/image-upload.service.ts` sadece 7 satırlık ince sarmalayıcı → **S3 dikişi tek nokta: `saveImage`**.
- Sipariş/kargo: `modules/vendors/vendor-orders.service.ts` → `transitionOrderItemStatus(vendorId, itemId,
  "shipped", {carrier, number})` **kargo firması + takip no'yu ZATEN zorunlu topluyor**; ama şu an
  **müşteriye e-posta atılmıyor**. Geçişler ileri-yön + tek adım (`pending→processing→shipped→delivered`).

**Discovery** (`services/discovery`, Go): Discover v1 KAPALI. Bu turda dokunulmaz.

---

## 1. Üç kesişen (cross-cutting) bulgu — kanıtlı

### 1a. "Sipariş sonrası çıkış yapıyor" bug'ı — KÖK NEDEN DOĞRULANDI
`orders/checkout.routes.ts` → `POST /payment-callback` iyzico'dan gelen **cross-site POST** (CSRF muaf).
`sameSite:"lax"` çerezi cross-site POST'ta gönderilmez → `@fastify/session` (varsayılan
`saveUninitialized:true`) **yeni boş bir oturum** üretir ve redirect yanıtındaki `Set-Cookie: gs_sid=...`
tarayıcıdaki **kimlikli çerezi ezer** → `siparis-sonucu`'na dönünce kullanıcı çıkış yapmış görünür.
**Çözüm:** `saveUninitialized:false` (misafir sepeti session'ı mutate ettiği için yine kaydedilir; sadece
hiç değişmeyen boş oturum çerez yazmaz). Küçük, düşük risk, yüksek değer. + regresyon testi.

### 1b. Kargo takip no e-postası — VERİ ZATEN VAR
`shipped` geçişinde carrier+number zaten toplanıyor. Yapılacak: bu geçiş başarıyla yazıldıktan sonra
müşterinin e-postasına (sipariş no + kargo firması + takip no + ürün özeti) **HTML e-posta** gönder.
Mailer hazır; sadece hook + şablon + gönderim (transaction dışında, best-effort, hata siparişi bozmaz).

### 1c. Amazon S3 görsel altyapısı — TEK DİKİŞ
`saveImage` diske yazıyor. Yapılacak: **`StorageBackend` soyutlaması** (`put(key, buffer, contentType) → url`),
iki implementasyon: `LocalStorage` (mevcut davranış, varsayılan) + `S3Storage` (AWS SDK v3, `PutObjectCommand`).
`STORAGE_DRIVER=local|s3` env ile seçilir; S3 kimlikleri env'de (repoya secret girmez). sharp→WebP adımı korunur;
yalnız son yazım + dönen URL değişir. **AWS kimliği hazır olana kadar local varsayılan kalır — hiçbir şey kırılmaz.**

---

## 2. Öncelik & faz planı

Kullanıcı önceliği: **(1) Login/Signup → (2) Satıcı paneli → (3) Anasayfa.** Kesişen düzeltmeler ayrı.

| Faz | Kapsam | Öncelik | Risk | Bağımlılık |
|---|---|---|---|---|
| **F0** | Correctness quick-wins: logout bug + kargo takip e-postası | P0 (önce) | Düşük | — |
| **F1** | Login/Signup premium + animasyonlu yeniden tasarım (müşteri+satıcı+admin giriş, şifre unut/sıfırla) | **1** | Düşük-Orta | F0 (oturum) |
| **F2** | Satıcı paneli: UI overhaul + analiz/filtreleme özellikleri | **2** | Orta | F1 |
| **F3** | Anasayfa UI/UX yeniden tasarımı | **3** | Orta | — |
| **F4** | Admin paneli: UI + analiz/filtreleme eksikleri | 4 | Orta | F2 örüntüleri |
| **F5** | Amazon S3 görsel altyapısı (pluggable storage, local default) | 5 (infra) | Düşük | AWS kimliği |

Her faz kendi commit setidir; anlamlı yığın bitince push → PR → review → feedback ile iterasyon.

---

## 3. Faz detayları (kapsam · dosyalar · testler · kabul kriteri)

### F0 — Correctness quick-wins
**Kapsam:** (a) `plugins/session.ts` → `saveUninitialized:false` + `rolling` davranışını doğrula.
(b) Kargo takip e-postası: `vendor-orders` "shipped" hook'u → `sendMail`, HTML şablon (`lib/emails/`).
**Dosyalar:** `apps/api/src/plugins/session.ts`, `modules/vendors/vendor-orders.service.ts` (veya repository),
yeni `apps/api/src/lib/emails/shipping-notification.ts`.
**Testler (vitest):**
- Oturum: kimlikli istekten sonra, session'ı mutate etmeyen bir isteğin `Set-Cookie` YAZMADIĞINI; misafir
  sepetinin (session mutate) YİNE kaydedildiğini doğrula.
- Kargo maili: `shipped` geçişi başarılıysa `sendMail` bir kez ve doğru alıcı/konu/gövde ile çağrılır;
  geçiş reddedilirse çağrılmaz; mail hatası geçişi/HTTP'yi bozmaz (best-effort).
**Kabul:** Ödeme dönüşünde oturum korunur; kargoya verince müşteriye takip e-postası gider.

### F1 — Login / Signup (Öncelik 1) — premium + animasyonlu
**Kapsam:** `giris`, `kayit`, `satici/giris`, `satici/kayit`, `sifremi-unuttum`, `sifre-sifirla`,
`admin/giris`. Split-screen editorial düzen: solda marka/atmosfer (yumuşak mesh gradient + grain +
katmanlı orb, Playfair başlık, staggered reveal), sağda cam/yüzey kartında form; sekme geçişleri, input
focus/hover/active mikro-etkileşimleri, buton press geri bildirimi, hata/başarı durumları tasarımlı,
`prefers-reduced-motion` tam destek, mobilde tek kolon.
**Yaklaşım:** Yeni premium yüzeyler için **CSS Modules** (`*.module.css`, Next-native, scope'lu, 116KB global'e
dokunmaz) + token'ları motion/elevation/radius ile genişlet (`styles/tokens.css` veya `:root` ek katman).
Form mantığı korunur (`mutateJson`/CSRF, mevcut auth route'ları). **Salt sunum katmanı değişir, davranış değil.**
**Dosyalar:** ilgili `page.tsx` + `*-form.tsx` + yeni `*.module.css`; paylaşılan `components/auth/*`
(AuthSplit, AuthCard, Field, SubmitButton).
**Testler:** form davranış testleri (validation, hata mesajı, submit disabled), Playwright E2E (müşteri login →
hesabım; kayıt → giriş; şifremi-unuttum akışı 200), reduced-motion smoke, 320/768/1440 responsive/overflow.
**Kabul:** Sayfalar "premium" durur, animasyonlar amaçlı, tüm mevcut auth davranışı korunur, a11y+responsive geçer.

### F2 — Satıcı paneli (Öncelik 2)
**Kapsam:** `satici/panel/*` (ürünler, siparişler, finans, raporlar, kampanyalar, koleksiyonlar, mağaza,
mağaza-düzeni, sorular, değerlendirmeler, bildirimler, toplu-yükleme, ayarlar). İki eksen:
1. **UI overhaul:** tutarlı panel shell (sidebar+topbar), tablo/kart tasarım sistemi, boş/yük/hata durumları,
   "dandik yazılmış" yerlerin (kopya/etiket/hiyerarşi) düzeltilmesi.
2. **Özellik boşlukları:** ürün/sipariş listelerinde **filtreleme** (durum, tarih, arama, kategori, stok) +
   **sıralama** + **analiz** (satış/gelir/dönüşüm özet kartları, zaman serisi) — mevcut
   `vendor-reports`/`vendor-finance`/`vendor-dashboard` route'larını kullan; eksikse API'ye additive uç ekle.
**Testler:** filtre/sıralama birim testleri (API repo düzeyi), panel tablo davranış testleri, E2E (satıcı giriş →
ürün filtrele → sipariş kargola akışı F0 e-postasıyla uçtan uca), responsive.
**Kabul:** Panel profesyonel ve tutarlı; filtre/analiz çalışır; mevcut satıcı işlevleri korunur.

### F3 — Anasayfa (Öncelik 3)
**Kapsam:** `(site)/page.tsx` (408 satır) + `(site)/layout.tsx`, hero-slider, kategori/ürün vitrinleri,
kampanya bandı, editorial bölümler. Grid-kırıcı editorial kompozisyon, ölçek kontrastı, atmosfer, anlamlı
scroll-reveal, hover durumları; homepage-sections/koleksiyon verisi korunur.
**Testler:** görsel regresyon (breakpoint screenshot), CWV/Lighthouse hedefleri (LCP<2.5s, CLS<0.1), a11y.
**Kabul:** Anasayfa "1 numara vitrin" gibi durur, performans bütçesi korunur.

### F4 — Admin paneli
**Kapsam:** `admin/panel/*` UI tutarlılığı + analiz/filtreleme (siparişler, ürünler, müşteriler, ödemeler,
iadeler, değerlendirmeler, mesajlar). F2 örüntüleri yeniden kullanılır.
**Kabul:** Admin paneli tutarlı ve fonksiyonel; mevcut yönetim işlevleri korunur.

### F5 — Amazon S3 görsel altyapısı (infra)
**Kapsam:** `StorageBackend` soyutlaması + `LocalStorage`/`S3Storage`, `STORAGE_DRIVER` env, `saveImage`
storage backend üzerinden yazar; dönen URL S3/CDN veya `/uploads/...`. AWS SDK v3. Mevcut görseller migrasyon
notu (opsiyonel script). **Local varsayılan; S3 yalnız env+kimlik gelince aktif.**
**Testler:** storage backend birim testi (local put→url; s3 put mock→url), `saveImage` her iki backend'de WebP üretir.
**Kabul:** Görsel yükleme S3'e yazabilir (kimlik varken); kimlik yokken local ile hiçbir şey kırılmaz; repoya secret girmez.

---

## 4. Tasarım yönü (frontend-design: "bir yön seç ve bağlan")
**Yön: Soft-luxury feminine boutique / editorial.** Kadın giyim pazaryerine uygun; mevcut palet
(dusty rose + mauve + gold) ui-ux-pro-max "Fashion rose + gold accent" (#BE185D/#EC4899/#D97706, bg #FDF2F8)
ile doğrulandı. Playfair display + Outfit gövde. Atmosfer: yumuşak mesh gradient, ince grain, katmanlı derinlik.
Motion: staggered giriş, 300–600ms yumuşak eğriler, bir-iki akılda kalıcı an; `prefers-reduced-motion` tam.
Compositor-dostu özellikler (transform/opacity/clip-path). Referans: AIAGENTS `ui-ux-pro-max-skill`
(`search.py --domain style|color|typography|landing --stack nextjs`).

## 5. Test stratejisi (özet)
- API: vitest unit/integration (F0 oturum+mail, F5 storage). Mevcut 123 test yeşil kalmalı.
- Web: davranış testleri + Playwright E2E kritik akışlar (auth, checkout, kargo) + görsel/responsive.
- Coding-style: immutability, küçük dosyalar (<800 satır), açık hata yönetimi, `any` yok, zod sınırlarda.

## 6. Guardrail'ler
- Next 16 breaking → kod öncesi `node_modules/next/dist/docs/` oku.
- `saveUninitialized:false` → misafir sepeti regresyon testiyle korunur.
- CSS Modules eklenmesi legacy sayfaları etkilemez (scope'lu).
- Domain hardcode YOK (host-only çerez, host-relative redirect korunur).
- S3 kimlikleri repoya girmez; secret yalnız env.
- Sunucuya deploy YOK; yalnız branch + PR. Force/reset/rebase/amend YOK; branch silme YOK.
</content>
