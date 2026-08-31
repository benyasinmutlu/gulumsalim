import Link from "next/link";
import { apiFetchJson, publicFetchJson } from "@/lib/api";
import type {
  AdminSlider,
  CampaignVendor,
  Category,
  CustomerProfile,
  FeaturedCoupon,
  ProductListItem,
  PublicVendorListItem,
  ResolvedHomepageCollection,
  ResolvedHomepageSection,
  SiteSettings,
} from "@/lib/types";
import { getSiteStats } from "@/lib/site-stats";
import PopularVendorsSection from "@/components/popular-vendors-section";
import CampaignVendorsSection from "@/components/campaign-vendors-section";
import HeroSlider from "@/components/hero-slider";
import CategorySidebar from "@/components/category-sidebar";
import HomeHeroCards from "@/components/home-hero-cards";
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

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

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

async function getFeaturedCoupon(): Promise<FeaturedCoupon | null> {
  try {
    return await publicFetchJson<FeaturedCoupon | null>("/coupons/featured");
  } catch {
    return null;
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
  const [categories, sliders, discover, sections, saleProducts, homepageCollections, settings, customer, featuredCoupon, vendors, campaignVendors, siteStats] =
    await Promise.all([
      getCategories(),
      getSliders(),
      getDiscoverFeed(),
      getHomepageSections(),
      getSaleProducts(),
      getHomepageCollections(),
      getSiteSettings(),
      getCurrentCustomer(),
      getFeaturedCoupon(),
      getVendors(),
      getCampaignVendors(),
      getSiteStats(),
    ]);
  const heroIntervalMs = settings.hero_interval_ms ? Number(settings.hero_interval_ms) : undefined;

  // bkz. kullanıcı isteği (2026-08-02): "siteye giren müşteriyi tanıyıp ona
  // göre düzenlenmeli sayfanın şekli" - kişiselleştirme artık sadece "Sana
  // Özel" ürün satırıyla sınırlı değil, "Kategorilere Göre Alışveriş"
  // satırının SIRASI da kullanıcının kişiselleştirilmiş akışında (discover)
  // en çok karşılaştığı kategorilere göre yeniden düzenleniyor (yeni bir
  // backend uç noktası gerekmedi - zaten sayfa yüklenirken çekilen discover
  // verisinden türetildi). cold-start/giriş yapmamış kullanıcıda değişiklik
  // yok, orijinal admin sıralaması korunur - yanlış/rastgele bir "kişisel"
  // sıralama göstermek yanıltıcı olurdu.
  const categoryAffinity = new Map<string, number>();
  if (discover.strategy === "personalized") {
    for (const p of discover.items) {
      categoryAffinity.set(p.categorySlug, (categoryAffinity.get(p.categorySlug) ?? 0) + 1);
    }
  }
  const personalizedCategories =
    categoryAffinity.size > 0
      ? [...categories].sort((a, b) => (categoryAffinity.get(b.slug) ?? 0) - (categoryAffinity.get(a.slug) ?? 0))
      : categories;

  type LayoutItem =
    | { kind: "section"; sortOrder: number; section: ResolvedHomepageSection }
    | { kind: "collection"; sortOrder: number; collection: ResolvedHomepageCollection };

  const layoutItems: LayoutItem[] = [
    ...sections.map((s): LayoutItem => ({ kind: "section", sortOrder: s.sortOrder, section: s })),
    ...homepageCollections.map((c): LayoutItem => ({ kind: "collection", sortOrder: c.sortOrder, collection: c })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="main-content">
      <div className="container home-hero-row">
        <CategorySidebar categories={categories} />
        <div className="home-hero-main">
          {sliders.length > 0 ? (
            <HeroSlider slides={sliders} intervalMs={heroIntervalMs} />
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
        <HomeHeroCards featuredCoupon={featuredCoupon} saleProducts={saleProducts} siteStats={siteStats} />
      </div>

      <div className="container">
        <QuickLinksRow />
      </div>

      {/* bkz. kullanıcı isteği (mockup): "Fırsatları Kaçırma! 🔥" hero'nun
          hemen altındaki İLK ürün satırı olmalı - önceki halde burada
          kişiselleştirilmiş "keşfet" satırı vardı (mockup'ta hiç yok),
          bu satır (ve kategoriler bölümü) daha aşağıya taşındı.
          bkz. kullanıcı isteği (2026-08-02): "timer'ı kaldır" - önceki
          gece-yarısına-kadar geri sayım kaldırıldı. */}
      <ScrollReveal anim="fade-up">
        <ProductRow title="Fırsatları Kaçırma! 🔥" ctaHref="/urunler?saleOnly=true" products={saleProducts} />
      </ScrollReveal>

      {saleProducts.length > 0 && (
        <ScrollReveal anim="fade-up">
          <DiscountTiers />
        </ScrollReveal>
      )}

      {/* bkz. kullanıcı isteği (2026-08-02): kampanyalar/kategoriler için
          burada ayrı, sabit kodlanmış bir önizleme bloğu vardı - hem admin
          panelinden yönetilemiyordu hem de aşağıdaki layoutItems döngüsüyle
          AYNI promo_banners bölümlerini TEKRAR gösteriyordu ("aynıların 2
          defa gösteriyor" bildirimi). Kaldırıldı - artık kampanya
          banner'ları VE kategori vitrinleri (yeni algoType="category",
          bkz. admin panel "Anasayfa Bölümleri") SADECE aşağıdaki tek,
          admin-sıralı layoutItems akışından geliyor, tekrar yok. */}

      {/* Yuvarlak "Popüler Kategoriler" satırı kaldırıldı - aşağıdaki fotoğraflı
          "Kategorilere Göre Alışveriş" ile duplicate + görsel olarak daha zayıftı. */}
      <ScrollReveal anim="fade-up">
        <CampaignVendorsSection vendors={campaignVendors} />
      </ScrollReveal>

      <ScrollReveal anim="fade-up">
        <PopularVendorsSection vendors={vendors} />
      </ScrollReveal>

      <ScrollReveal anim="fade-up">
        <NewsletterBanner />
      </ScrollReveal>

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

      {categories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Koleksiyonlarımız</span>
              <h2 className="section-title">Kategorilere Göre Alışveriş</h2>
              <p className="section-subtitle">
                {categoryAffinity.size > 0
                  ? "Sana göre sıralandı - en çok ilgilendiğin kategoriler önde"
                  : "Stilinize en uygun parçaları keşfetmek için kategorileri inceleyin"}
              </p>
            </div>
            <HscrollArrows>
              <div className="category-grid hcat-grid">
                {personalizedCategories.map((c, i) => (
                  <Link key={c.id} href={`/${c.slug}`} className={`hcat-card hcat-tint-${i % 4}`}>
                    <div className="hcat-img-wrap">
                      {c.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt={c.name} className="hcat-img" />
                      )}
                      <div className="hcat-overlay" />
                      <span className="hcat-icon-badge">
                        <i className={c.icon || "fas fa-tag"} />
                      </span>
                      <span className="hcat-name">{c.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </HscrollArrows>
          </div>
        </section>
      )}

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

      <div className="container" style={{ textAlign: "center", margin: "-20px 0 40px" }}>
        <Link href="/urunler" className="btn btn-secondary btn-lg">
          Tüm Koleksiyonu Gör
        </Link>
      </div>
    </main>
  );
}

