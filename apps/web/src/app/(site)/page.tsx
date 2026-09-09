import Link from "next/link";
import { apiFetchJson, publicFetchJson } from "@/lib/api";
import type {
  AdminSlider,
  CampaignVendor,
  CustomerProfile,
  ProductListItem,
  PublicVendorListItem,
  ResolvedHomepageCollection,
  ResolvedHomepageSection,
  SiteSettings,
} from "@/lib/types";
import { productUrl } from "@/lib/types";
import PopularVendorsSection from "@/components/popular-vendors-section";
import CampaignVendorsSection from "@/components/campaign-vendors-section";
import HeroSlider, { type HeroSlide } from "@/components/hero-slider";
import HeroMobileCarousel from "@/components/hero-mobile-carousel";
import CountdownTimer from "@/components/countdown-timer";
import ProductCard from "@/components/product-card";
import HscrollArrows from "@/components/hscroll-arrows";
import ScrollReveal from "@/components/scroll-reveal";
import PromoBannerImage from "@/components/promo-banner-image";
import PromoBannerLink from "@/components/promo-banner-link";
import PromoBannerImpression from "@/components/promo-banner-impression";
import QuickLinksRow from "@/components/quick-links-row";
import DiscountTiers from "@/components/discount-tiers";
import NewsletterBanner from "@/components/newsletter-banner";
import SectionAnalyticsTracker from "@/components/section-analytics-tracker";

async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

async function getSaleProducts(): Promise<ProductListItem[]> {
  try {
    const res = await apiFetchJson<{ items: ProductListItem[] }>("/products?saleOnly=true&limit=8");
    return res.items;
  } catch {
    return [];
  }
}

async function getSeasonTrendProducts(): Promise<ProductListItem[]> {
  try {
    const res = await apiFetchJson<{ items: ProductListItem[] }>("/products?sort=popular&limit=16");
    return res.items;
  } catch {
    return [];
  }
}

// bkz. kullanıcı isteği: "bu 2 yerin mantık olarak aynı olması saçma değil
// mi" - hero (Öne Çıkanlar) daha önce seasonTrendProducts ile aynı havuzu
// (sort=popular, yani ortalama puan) kullanıyordu, "Sezon Trendleri" ile
// birebir aynı ürünleri gösteriyordu. Hero artık gerçekten farklı bir
// ölçüte (salesCount) dayanıyor.
async function getBestSellingProducts(): Promise<ProductListItem[]> {
  try {
    const res = await apiFetchJson<{ items: ProductListItem[] }>("/products?sort=best_selling&limit=16");
    return res.items;
  } catch {
    return [];
  }
}

async function getSliders(): Promise<AdminSlider[]> {
  try {
    return await apiFetchJson<AdminSlider[]>("/sliders");
  } catch {
    return [];
  }
}

interface DiscoverFeed {
  items: ProductListItem[];
  strategy: "personalized" | "cold_start" | "unavailable";
}

async function getDiscoverFeed(): Promise<DiscoverFeed> {
  try {
    return await apiFetchJson<DiscoverFeed>("/discover");
  } catch {
    return { items: [], strategy: "unavailable" };
  }
}

async function getHomepageSections(): Promise<ResolvedHomepageSection[]> {
  try {
    return await apiFetchJson<ResolvedHomepageSection[]>("/homepage-sections");
  } catch {
    return [];
  }
}

async function getHomepageCollections(): Promise<ResolvedHomepageCollection[]> {
  try {
    return await apiFetchJson<ResolvedHomepageCollection[]>("/homepage-collections");
  } catch {
    return [];
  }
}

// Her bölüm türü, "Tümünü Gör" ile kendi temasına uygun filtrelenmiş ürün
// listesine gitsin diye - hepsi aynı genel /urunler'e gitmiyor.
function sectionHref(algoType: string): string {
  switch (algoType) {
    case "new_arrivals":
      return "/urunler?sort=newest";
    case "best_sellers":
    case "weekly_best":
    case "featured":
      return "/urunler?sort=popular";
    default:
      return "/urunler";
  }
}

const TITLE_FONT_CLASS: Record<string, string> = {
  sans: "sec-font-sans",
  italic: "sec-font-italic",
};

// bkz. kullanıcı isteği: "background rengi beyaz olsun ... o kutunun
// dışına çıksın ürünler kayarken ... sola kaydırma otomatik olsun" - önceki
// renkli/padding'li kart sarmalayıcısı tamamen kaldırıldı; şerit artık
// sayfanın beyaz zemininde, ekran kenarına kadar taşıyor (bkz.
// .hero-mobile-grid CSS - sadece 16px sol boşluk, sağda serbest taşma) ve
// otomatik ilerliyor (bkz. hero-mobile-carousel.tsx, ~2.4sn'de bir).
function HeroMobileGrid({ products }: { products: ProductListItem[] }) {
  const items = products.filter((p) => p.primaryImageUrl).slice(0, 8);
  if (items.length === 0) return null;
  return (
    <div className="hero-mobile-grid">
      <ScrollReveal anim="fade-up">
        <div className="hero-mobile-grid-heading-row">
          {/* bkz. kullanıcı isteği: "sezonun trendi ile sezon trendleri
              arasındaki farklar neler ... başlıkları aynı" - ikisi de aynı
              seasonTrendProducts havuzunu kullanıyor, isimler de neredeyse
              aynıydı, kafa karıştırıyordu. Bu üsttekine ayrı bir isim verildi. */}
          <span className="deal-shelf-title">Öne Çıkanlar</span>
        </div>
        <HeroMobileCarousel products={items} />
      </ScrollReveal>
    </div>
  );
}

// bkz. kullanıcı isteği: "bunu demiyorum az önce attığım görseldeki
// tasarımı yap diyorum sadece" - önceki halde renkli kart sarmalayıcısını
// (mockup'taki gibi) kaldırıp sayfanın beyaz zeminine ve rozeti fotoğraf
// üzerine taşımıştım, bu istenen değildi. Şimdi mockup'a birebir sadık:
// pastel renkli kart (yeşil yerine markanın tonu #C06C84 ailesi), rozet
// fotoğrafın üzerinde değil fiyatın yanında, altta tam genişlikte CTA.
function SeasonTrendsMobileGrid({ products }: { products: ProductListItem[] }) {
  const items = products.filter((p) => p.primaryImageUrl).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <div className="mobile-only">
      <ScrollReveal anim="fade-up">
        <div className="season-trends-mobile-card">
          <span className="deal-shelf-title">Sezon Trendleri</span>
          <p className="section-subtitle season-trends-mobile-subtitle">Bu sezon en çok ilgi gören parçalar</p>
          <div className="season-trends-mobile-grid">
            {items.map((p, i) => (
              <Link key={p.id} href={productUrl(p)} className="season-trends-mobile-tile">
                <div className="season-trends-mobile-tile-img-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.primaryImageUrl as string} alt={p.name} className="season-trends-mobile-tile-img" loading="lazy" />
                </div>
                <div className="season-trends-mobile-tile-body">
                  <div className="season-trends-mobile-tile-name">{p.name}</div>
                  <div className="season-trends-mobile-tile-meta">
                    <span className="season-trends-mobile-tile-price">
                      {Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                    </span>
                    {i === 0 && <span className="season-trends-mobile-badge">Beğenilenler</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <Link href="/urunler?sort=popular" className="season-trends-mobile-cta">
            Daha Fazla Keşfet <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </ScrollReveal>
    </div>
  );
}

// gulumsalim.com anasayfasının ("index.php") bölüm sırasının birebir
// karşılığı: hero → trust-strip → (keşfet/kişiselleştirilmiş ürün satırı) →
// kategoriler → indirimli ürünler → admin'in kurduğu sıralı bölümler
// (kampanya bannerları dahil, artık sabit bir blok değil) → "Tüm Koleksiyonu
// Gör" → Avantajlarımız. Her ürün satırı eski sitedeki gibi bir
// "section-scroll-shell" kutusu içinde, yatay kaydırılabilir (hscroll).
function ProductRow({
  title,
  subtitle,
  titleColor,
  titleFont,
  subtitleColor,
  bgStyle,
  bgColor,
  ctaHref,
  products,
  endsAt,
}: {
  title: string;
  subtitle?: string | null;
  titleColor?: string | null;
  titleFont?: string;
  subtitleColor?: string;
  bgStyle?: string;
  bgColor?: string;
  ctaHref?: string | null;
  products: ProductListItem[];
  endsAt?: string;
}) {
  if (products.length === 0) return null;
  // bkz. kullanıcı isteği (2026-08-02): "sana özel, bu haftanın en iyileri,
  // en yeni ürünler, çok satanlar, son baktıklarınız bunlarda aynı olsun" -
  // kategori vitrini için kurulan .deal-shelf görsel dili (başlık dikdörtgenin
  // üstünde sol tarafta, altında ürün şeridi, sonunda "Tümünü Gör" kartı)
  // artık TÜM algoritmik anasayfa satırlarında ortak (bkz. category-deal-
  // shelf.tsx aynı deseni /kampanyalar sayfasında kullanır).
  return (
    <section className={`products-section${bgStyle === "alt" ? " section-bg-alt" : ""}`} style={{ background: bgColor ?? undefined }}>
      <div className="container">
        <div className="deal-shelf">
          <div className="deal-shelf-header">
            <div>
              <span className={`deal-shelf-title ${TITLE_FONT_CLASS[titleFont ?? ""] ?? ""}`} style={{ color: titleColor ?? undefined }}>
                {title}
              </span>
              {subtitle && (
                <p className="section-subtitle" style={{ color: subtitleColor ?? undefined }}>
                  {subtitle}
                </p>
              )}
            </div>
            {endsAt && <CountdownTimer endsAt={endsAt} />}
          </div>
          <HscrollArrows>
            <div className="product-grid hscroll deal-shelf-products">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
              {ctaHref && (
                <Link href={ctaHref} className="deal-shelf-more-card">
                  <span>Tümünü Gör</span>
                  <i className="fas fa-arrow-right" />
                </Link>
              )}
            </div>
          </HscrollArrows>
        </div>
      </div>
    </section>
  );
}

// homepage-sections.php'deki algo_type='promo_banners' bölümünün karşılığı -
// artık kategoriler/indirimli ürünler arasında sabit bir blok değil, diğer
// algoritmik bölümlerle aynı sort_order akışında yer alan bir bölüm türü.
function BannerRow({ section }: { section: ResolvedHomepageSection }) {
  const banners = section.banners ?? [];
  if (banners.length === 0) return null;
  const isStack = section.bannerLayout === "stack";
  return (
    <section className={`products-section promo-section-plain${section.bgStyle === "alt" ? " section-bg-alt" : ""}`} style={{ background: section.bgColor ?? undefined }}>
      <div className="container">
        {section.showTitle && (
          <div className="section-header promo-section-title">
            <h2 className={`section-title ${TITLE_FONT_CLASS[section.titleFont ?? ""] ?? ""}`} style={{ color: section.titleColor ?? undefined }}>
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="section-subtitle" style={{ color: section.subtitleColor ?? undefined }}>
                {section.subtitle}
              </p>
            )}
          </div>
        )}
        <div className={isStack ? "promo-stack" : "promo-grid"}>
          {banners.map((b) => {
            const card = (
              <PromoBannerImpression bannerId={b.id}>
                <PromoBannerLink bannerId={b.id} href={b.resolvedLink ?? "/urunler"} className="promo-card">
                  <PromoBannerImage
                    className="promo-card-img"
                    images={[b.image, ...(b.extraImages ?? [])]}
                    rotateSeconds={b.rotateSeconds}
                    alt={b.title}
                  />
                  <div className="promo-card-overlay" />
                  <div className="promo-content" style={{ color: b.textColor ?? undefined }}>
                    <h3 style={{ color: b.textColor ?? undefined }}>{b.title}</h3>
                    {b.subtitle && <p>{b.subtitle}</p>}
                    {b.buttonText && <span className="btn btn-sm btn-primary promo-cta">{b.buttonText}</span>}
                  </div>
                </PromoBannerLink>
              </PromoBannerImpression>
            );
            return b.animStyle && b.animStyle !== "none" ? (
              <ScrollReveal key={b.id} anim={b.animStyle}>
                {card}
              </ScrollReveal>
            ) : (
              <div key={b.id}>{card}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await publicFetchJson<SiteSettings>("/site-settings");
  } catch {
    return {};
  }
}

async function getVendors(): Promise<PublicVendorListItem[]> {
  try {
    return await apiFetchJson<PublicVendorListItem[]>("/vendors");
  } catch {
    return [];
  }
}

async function getCampaignVendors(): Promise<CampaignVendor[]> {
  try {
    return await apiFetchJson<CampaignVendor[]>("/campaigns/vendors");
  } catch {
    return [];
  }
}

export default async function Home() {
  const [sliders, discover, sections, saleProducts, seasonTrendCandidates, bestSellingCandidates, homepageCollections, settings, customer, vendors, campaignVendors] =
    await Promise.all([
      getSliders(),
      getDiscoverFeed(),
      getHomepageSections(),
      getSaleProducts(),
      getSeasonTrendProducts(),
      getBestSellingProducts(),
      getHomepageCollections(),
      getSiteSettings(),
      getCurrentCustomer(),
      getVendors(),
      getCampaignVendors(),
    ]);
  const heroIntervalMs = settings.hero_interval_ms ? Number(settings.hero_interval_ms) : undefined;
  const saleProductIds = new Set(saleProducts.map((product) => product.id));
  const nonSaleTrendProducts = seasonTrendCandidates.filter((product) => !saleProductIds.has(product.id));
  const seasonTrendProducts = (nonSaleTrendProducts.length >= 4 ? nonSaleTrendProducts : seasonTrendCandidates).slice(0, 8);
  const nonSaleBestSelling = bestSellingCandidates.filter((product) => !saleProductIds.has(product.id));
  const bestSellingProducts = (nonSaleBestSelling.length >= 4 ? nonSaleBestSelling : bestSellingCandidates).slice(0, 8);

  // bkz. kullanıcı isteği: "'Kadının Gücü' yerinde ürünler dönsün orayı
  // canlandıralım" - hero'da tek statik banner (admin'in girdiği tek
  // slider) vardı, hiç dönmüyordu. Admin'in banner'ı ilk slayt olarak
  // kalır, arkasından gerçek çok-ilgi-gören ürünlerden (aynı "Sezon
  // Trendleri" rafını besleyen liste) otomatik slaytlar eklenir - id'ler
  // gerçek slider id'leriyle çakışmasın diye negatif. "kind: product" ile
  // işaretlenir ki HeroSlider bunları admin banner'ından farklı, kırpma
  // yapmayan split düzende çizsin (bkz. hero-slider.tsx - "hiç olmadı bu
  // şekilde" geri bildiriminden sonra: tam ekran background-size:cover
  // dikey ürün fotoğraflarını feci kırpıyordu).
  const heroProductSlides: HeroSlide[] = bestSellingProducts
    .filter((p) => p.primaryImageUrl)
    .slice(0, 4)
    .map((p, i) => ({
      id: -1000 - p.id,
      image: p.primaryImageUrl as string,
      linkUrl: productUrl(p),
      title: p.name,
      subtitle: `${Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`,
      buttonText: "Ürünü İncele",
      textColor: null,
      textPosition: null,
      sortOrder: sliders.length + i,
      isActive: true,
      kind: "product",
    }));
  const heroSlides: HeroSlide[] = [...sliders, ...heroProductSlides];

  type LayoutItem =
    | { kind: "section"; sortOrder: number; section: ResolvedHomepageSection }
    | { kind: "collection"; sortOrder: number; collection: ResolvedHomepageCollection };

  const layoutItems: LayoutItem[] = [
    ...sections.map((s): LayoutItem => ({ kind: "section", sortOrder: s.sortOrder, section: s })),
    ...homepageCollections.map((c): LayoutItem => ({ kind: "collection", sortOrder: c.sortOrder, collection: c })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="main-content premium-home">
      <section className="home-stage hero-desktop-only" aria-label="Öne çıkan koleksiyonlar">
      <div className="container home-hero-row">
        <div className="home-hero-main">
          {heroSlides.length > 0 ? (
            <HeroSlider slides={heroSlides} intervalMs={heroIntervalMs} />
          ) : (
            <section className="hero-section">
              <div className="hero-content">
                <h1 className="hero-title">Hoş Geldiniz</h1>
                <p className="hero-subtitle">
                  Kadın giyimde şıklığı tamamlayan seçkiler — özenle seçilmiş satıcılardan, tek bir adreste.
                </p>
                <div className="hero-actions">
                  <Link href="/urunler" className="btn btn-primary btn-lg">
                    Keşfetmeye Başla
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
      </section>

      <HeroMobileGrid products={bestSellingProducts} />

      <section className="container home-discovery-strip" aria-labelledby="home-discovery-title">
        <div className="home-discovery-heading">
          <span className="section-tag">Hızlı keşif</span>
          <h2 id="home-discovery-title">Aradığın stile doğrudan ulaş</h2>
        </div>
        <QuickLinksRow />
      </section>

      {/* Üst navigasyonda kategori erişimi bulunduğu için tekrar eden büyük
          kategori vitrini kaldırıldı. Ana keşif akışı doğrudan gerçek ürün
          raflarıyla devam eder. */}
      <ScrollReveal anim="fade-up">
        <ProductRow title="İndirimli Ürünler" subtitle="Fiyatı düşen ürünlerden güncel seçkiler" ctaHref="/urunler?saleOnly=true" products={saleProducts} />
      </ScrollReveal>

      {saleProducts.length > 0 && (
        <ScrollReveal anim="fade-up">
          <DiscountTiers />
        </ScrollReveal>
      )}

      <div className="desktop-only">
        <ScrollReveal anim="fade-up">
          <ProductRow
            title="Sezon Trendleri"
            subtitle="Bu sezon en çok ilgi gören parçalar"
            ctaHref="/urunler?sort=popular"
            products={seasonTrendProducts}
          />
        </ScrollReveal>
      </div>
      <SeasonTrendsMobileGrid products={seasonTrendProducts} />

      {/* bkz. kullanıcı isteği (2026-08-02): kampanyalar/kategoriler için
          burada ayrı, sabit kodlanmış bir önizleme bloğu vardı - hem admin
          panelinden yönetilemiyordu hem de aşağıdaki layoutItems döngüsüyle
          AYNI promo_banners bölümlerini TEKRAR gösteriyordu ("aynıların 2
          defa gösteriyor" bildirimi). Kaldırıldı - artık kampanya
          banner'ları VE kategori vitrinleri (yeni algoType="category",
          bkz. admin panel "Anasayfa Bölümleri") SADECE aşağıdaki tek,
          admin-sıralı layoutItems akışından geliyor, tekrar yok. */}

      {/* bkz. kullanıcı isteği: "müşteri giriş yapmışsa yasin, sana özel
          ürünler olsun" - kişiselleştirilmiş akış varsa başlıkta müşterinin
          adı geçer. Mockup'ta bu satır yok, bu yüzden yukarıdaki mockup
          sıralı bölümlerin ALTINA taşındı (özellik korunuyor, sadece
          öncelik/konum değişti). */}
      {/* bkz. kullanıcı isteği (2026-08-02): "backendinde akıllı algoritmalar
          olup kullanıcıyı tanımalı ... ona göre göstermeli" - bu satır zaten
          kişiselleştirilmiş algoritmayla (discover pipeline) besleniyordu,
          sadece görsel olarak diğer satırlardan ayrışmıyordu. Artık tonlu
          arkaplan (bgStyle="alt") + "algoritma bunu neden seçti" açıklayan
          bir alt başlıkla kişiselleştirmenin gerçek/görünür olduğu
          vurgulanıyor - fallback (cold-start) durumunda algoritma iddiası
          yapan bir alt başlık YOK, yanıltıcı olmasın diye. */}
      <ScrollReveal anim="fade-up">
        <ProductRow
          title={
            customer && discover.strategy === "personalized"
              ? `${customer.fullName.split(" ")[0]}, Sana Özel`
              : discover.strategy === "personalized"
                ? "Senin İçin"
                : "Beğenebileceğin Ürünler"
          }
          subtitle={discover.strategy === "personalized" ? "Gezinme ve beğenilerine göre senin için seçildi" : undefined}
          bgStyle="alt"
          ctaHref="/sana-ozel"
          products={discover.items}
        />
      </ScrollReveal>

      {/* bkz. kullanıcı isteği: "buradaki düzen tam olarak anasayfanın
          sıralama olarak birebir aynısı olmalı" - anasayfa bölümleri
          (kampanyalar dahil) ve anasayfa koleksiyonları önceden İKİ AYRI
          blok halinde, koleksiyonlar HER ZAMAN bölümlerden sonra sabit
          şekilde render ediliyordu. Artık ikisi TEK bir sortOrder uzayında
          birleştirilip sıralanıyor - admin panelindeki (anasayfa-bölümleri)
          birleşik liste ile burası artık her zaman birebir aynı sırada. */}
      {layoutItems.map((item) =>
        item.kind === "section" ? (
          <ScrollReveal key={`s-${item.section.id}`} anim={item.section.animStyle}>
            <SectionAnalyticsTracker sectionId={item.section.id}>
              {item.section.algoType === "promo_banners" ? (
                <BannerRow section={item.section} />
              ) : (
                <ProductRow
                  title={item.section.title}
                  subtitle={item.section.subtitle}
                  titleColor={item.section.titleColor}
                  titleFont={item.section.titleFont}
                  subtitleColor={item.section.subtitleColor}
                  bgStyle={item.section.bgStyle}
                  bgColor={item.section.bgColor}
                  ctaHref={
                    item.section.seoSlug
                      ? `/${item.section.seoSlug}`
                      : item.section.algoType === "category" && item.section.categorySlug
                        ? `/${item.section.categorySlug}${item.section.saleOnly ? "?saleOnly=true" : ""}`
                        : sectionHref(item.section.algoType)
                  }
                  products={item.section.products}
                  endsAt={item.section.algoType === "flash_sale" ? item.section.endsAt : undefined}
                />
              )}
            </SectionAnalyticsTracker>
          </ScrollReveal>
        ) : (
          <ProductRow
            key={`c-${item.collection.id}`}
            title={item.collection.title}
            subtitle={item.collection.subtitle}
            titleColor={item.collection.textColor}
            ctaHref={item.collection.linkUrl}
            products={item.collection.products}
          />
        ),
      )}

      <section className="home-store-discovery" aria-label="Mağaza keşfi">
        <ScrollReveal anim="fade-up">
          <CampaignVendorsSection vendors={campaignVendors} />
        </ScrollReveal>

        <ScrollReveal anim="fade-up">
          <PopularVendorsSection vendors={vendors} />
        </ScrollReveal>
      </section>

      <ScrollReveal anim="fade-up">
        <NewsletterBanner />
      </ScrollReveal>

      <div className="container home-all-products-cta">
        <Link href="/urunler" className="btn btn-secondary btn-lg">
          Tüm Koleksiyonu Gör
        </Link>
      </div>
    </main>
  );
}

