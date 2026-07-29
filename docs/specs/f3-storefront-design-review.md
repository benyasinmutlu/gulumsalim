# F3 — Storefront Tasarım & Mimari İncelemesi (anasayfa + ürün sergileme)

> Bu bir **inceleme + yön belgesidir**, build değil. Amaç: anasayfayı "basit çocuk işi"
> görünümünden çıkarıp F1 ile tutarlı **soft-luxury editorial** bir vitrine taşımak.
> Uygulama sonraki oturumda, bu belgeye göre fazlı yapılacak. Branch-only, sunucuya dokunulmaz.

Tarih: 2026-07-29 · İlgili: [[ui-uplift-project]], [ui-uplift-and-features-spec.md](ui-uplift-and-features-spec.md)

---

## 1. Mevcut durum — neden "amatör" duruyor (kanıtlı)

Anasayfa (`app/apps/web/src/app/(site)/page.tsx`, 408 satır) mimari olarak **iyi**: veri-güdümlü,
admin'den yönetilebilir. Bileşenler: `HeroSlider`, `TrustStrip`, `Advantages`, kategori şeridi,
dinamik `ProductRow`/`BannerRow` bölümleri, `ProductCard`, `ScrollReveal`, promo banner'lar, join-CTA.

Sorun **görsel katman** — stiller eski PHP sitesinden taşınan 116KB `globals.css`'ten geliyor:

1. **Hiyerarşi yok.** Her bölüm aynı `section-title` + `section-subtitle` kalıbı; ölçek kontrastı,
   editoryal vurgu yok. Hepsi eşit ağırlıkta → göz nereye bakacağını bilmiyor.
2. **Düz, derinliksiz.** Katman/gölge/overlap yok; bölümler alt alta dizili "liste" gibi.
3. **Tek tip kart ızgarası.** `ProductCard`'lar uniform; grid-kırıcı/bento kompozisyon yok
   (web/design-quality.md'de yasaklı "default card grid" örüntüsü).
4. **Atmosfer yok.** Düz zeminler; gradient/grain/doku yok (F1'deki mesh atmosferin tersi).
5. **Hero zayıf.** `<h1>Hoş Geldiniz</h1>` + slider — jenerik; markanın karakterini taşımıyor.
6. **Motion neredeyse yok.** `ScrollReveal` bileşeni VAR ama etkisi cılız; giriş sekansı,
   hover derinliği, sticky/scrollytelling anları yok.
7. **Tipografi kullanılmıyor.** Playfair display fontu yüklü ama vitrinde neredeyse hiç
   kullanılmamış — başlıklar karaktersiz.

**Özet:** mimariyi bozmadan yalnız sunum katmanını yeniden yazmak yeterli — F1'deki gibi
scoped CSS Modules + token genişletme, `globals.css`'e dokunmadan.

---

## 2. Tasarım yönü (F1 ile tek dil: soft-luxury editorial)

**Palet:** F1 ile aynı — dusty rose `#C06C84`, deep rose `#8B3A62`, gold `#D4A574`, mauve `#6C5B7B`,
warm bg `#FFF8F5`. **Tipografi:** Playfair Display (editoryal başlık, italik vurgu) + Outfit (gövde).
**Atmosfer:** yumuşak mesh gradient + ince grain, katmanlı derinlik. **Motion:** amaçlı — giriş
sekansı, scroll-reveal (mevcut bileşeni güçlendir), hover derinliği; `prefers-reduced-motion` tam.

## 3. Bölüm bölüm premium hamleler

| Bölüm | Şimdi | Hedef |
|---|---|---|
| **Hero** | "Hoş Geldiniz" + düz slider | Editoryal hero: Playfair büyük başlık + italik vurgu, katmanlı görsel, yumuşak gradient overlay, staggered giriş; slider'a ken-burns/parallax dokunuşu, zarif dot/ok kontrolleri |
| **Trust strip** | Düz ikon sırası | İnce cam yüzey şerit, ayraçlar, hafif hover |
| **Kategoriler** | Uniform kart şeridi | Bento/editoryal düzen: değişken boyutlu kartlar, görsel overlay + Playfair etiket, hover zoom + reveal |
| **Ürün satırları** | Eşit kart ızgarası | Yatay-kaydırmalı "koleksiyon" rafları (mevcut `HscrollArrows` ile), yükseltilmiş `ProductCard` (yumuşak gölge, hover lift, hızlı-ekle animasyonu, favori mikro-etkileşimi, indirim rozeti) |
| **Promo banner** | Düz görsel + başlık | Overlap/asimetri, gradient overlay, Playfair başlık, hover parallax |
| **Advantages** | Düz liste | İkon-çipli kartlar (F1 perk stiliyle uyumlu) |
| **Join-CTA** | Basit kutu | Atmosferli tam-genişlik band: gradient + grain, güçlü başlık, tek net CTA |

## 4. Mimari iyileştirmeler
- **Paylaşılan storefront token katmanı:** `styles/tokens.css` (motion/elevation/radius/space
  ölçekleri) — F1 auth ve F3 vitrin aynı ölçeği paylaşsın. `globals.css` dokunulmaz; token'lar `:root`e eklenir.
- **CSS Modules per-surface:** `hero.module.css`, `category-bento.module.css`, `product-card.module.css`,
  `section.module.css` — scope'lu, legacy sınıflarla çakışmaz.
- **`ProductCard` yükseltmesi** (tek bileşen, tüm vitrini etkiler): görsel oranı, hover lift/zoom,
  fiyat/indirim hiyerarşisi, hızlı-ekle + favori mikro-etkileşimleri, `content-visibility` ile perf.
- **Motion sistemi:** mevcut `ScrollReveal` + `useReducedMotion` hook; IntersectionObserver ile
  staggered reveal; compositor-dostu (transform/opacity) — CWV bütçesi korunur (LCP<2.5s, CLS<0.1).
- **Görsel/perf:** hero görseli `priority` + `fetchpriority=high`; alt bölümler `loading=lazy`;
  açık width/height (CLS yok); AVIF/WebP. Veri-güdümlü bölümler (admin sections) **korunur**.
- **Ürün sergileme subpage'leri** (`/urunler`, `/urun/[slug]`, `/kategori/[slug]`, `/magaza/[slug]`,
  `/arama`) aynı token + kart + section sistemini devralır → geçişler ve hiyerarşi tutarlı.

## 5. F1 motion yükseltmesi (senin geri bildirimin)
Login sol paneline **canlı ambient hareket** eklenecek: (a) yavaş akan **animasyonlu mesh gradient**
(canvas/CSS, düşük maliyet), veya (b) yumuşak geçişli **ürün/atmosfer görsel döngüsü** (ken-burns +
crossfade), veya (c) hafif partikül/bokeh. Biri seçilip eklenecek; `prefers-reduced-motion`'da statik
zarif kare gösterilir. (Video dosyası yerine canvas/CSS önerilir: bağımlılık yok, hızlı, tema-uyumlu.)

## 6. F3 uygulama fazlaması (sonraki oturum)
1. **F3.0** storefront token katmanı + `ProductCard` yükseltmesi (en yüksek kaldıraç — her yerde görünür).
2. **F3.1** Hero + kategoriler bento (anasayfa üst kısım — ilk izlenim).
3. **F3.2** Ürün satırları rafları + promo banner + advantages + join-CTA.
4. **F3.3** Ürün sergileme subpage'leri (listeleme/detay/kategori/mağaza/arama) aynı sistemle.
5. **F3.4** F1 motion yükseltmesi.
6. Her faz: görsel doğrulama (Playwright screenshot) + CWV/a11y + responsive; branch → PR.

## 7. Guardrail'ler
Mimari/veri-güdümlü bölümler korunur; davranış değişmez, yalnız sunum. `globals.css` ve `ga-*`
dokunulmaz. Domain hardcode yok. Sunucuya deploy yok. Perf bütçesi (web/performance.md) korunur.
