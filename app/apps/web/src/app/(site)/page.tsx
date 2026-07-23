import Link from "next/link";
import { apiFetchJson, publicFetchJson } from "@/lib/api";
import type {
  AdminSlider,
  Category,
  CustomerProfile,
  ProductListItem,
  ResolvedHomepageCollection,
  ResolvedHomepageSection,
  SiteSettings,
} from "@/lib/types";
import HeroSlider from "@/components/hero-slider";
import TrustStrip from "@/components/trust-strip";
import Advantages from "@/components/advantages";
import ProductCard from "@/components/product-card";
import HscrollArrows from "@/components/hscroll-arrows";
import ScrollReveal from "@/components/scroll-reveal";
import PromoBannerImage from "@/components/promo-banner-image";
import PromoBannerLink from "@/components/promo-banner-link";
import PromoBannerImpression from "@/components/promo-banner-impression";

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
}) {
  if (products.length === 0) return null;
  return (
    <section className={`products-section${bgStyle === "alt" ? " section-bg-alt" : ""}`} style={{ background: bgColor ?? undefined }}>
      <div className="container">
        <div className="section-scroll-shell">
          <div className="section-header section-header-flex">
            <div>
              <h2 className={`section-title ${TITLE_FONT_CLASS[titleFont ?? ""] ?? ""}`} style={{ color: titleColor ?? undefined }}>
                {title}
              </h2>
              {subtitle && (
                <p className="section-subtitle" style={{ color: subtitleColor ?? undefined }}>
                  {subtitle}
                </p>
              )}
            </div>
            {ctaHref && (
              <Link href={ctaHref} className="section-cta">
                Tümünü Gör
              </Link>
            )}
          </div>
          <HscrollArrows>
            <div className="product-grid hscroll">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
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

export default async function Home() {
  const [categories, sliders, discover, sections, saleProducts, homepageCollections, settings, customer] = await Promise.all([
    getCategories(),
    getSliders(),
    getDiscoverFeed(),
    getHomepageSections(),
    getSaleProducts(),
    getHomepageCollections(),
    getSiteSettings(),
    getCurrentCustomer(),
  ]);
  const heroIntervalMs = settings.hero_interval_ms ? Number(settings.hero_interval_ms) : undefined;

  type LayoutItem =
    | { kind: "section"; sortOrder: number; section: ResolvedHomepageSection }
    | { kind: "collection"; sortOrder: number; collection: ResolvedHomepageCollection };

  const layoutItems: LayoutItem[] = [
    ...sections.map((s): LayoutItem => ({ kind: "section", sortOrder: s.sortOrder, section: s })),
    ...homepageCollections.map((c): LayoutItem => ({ kind: "collection", sortOrder: c.sortOrder, collection: c })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className="main-content">
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

      <TrustStrip />

      {/* bkz. kullanıcı isteği: "müşteri giriş yapmışsa yasin, sana özel
          ürünler olsun" - kişiselleştirilmiş akış varsa başlıkta müşterinin
          adı geçer. */}
      <ProductRow
        title={
          customer && discover.strategy === "personalized"
            ? `${customer.fullName.split(" ")[0]}, Sana Özel`
            : discover.strategy === "personalized"
              ? "Senin İçin"
              : "Beğenebileceğin Ürünler"
        }
        ctaHref="/sana-ozel"
        products={discover.items}
      />

      {categories.length > 0 && (
        <section className="categories-section">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Koleksiyonlarımız</span>
              <h2 className="section-title">Kategorilere Göre Alışveriş</h2>
              <p className="section-subtitle">Stilinize en uygun parçaları keşfetmek için kategorileri inceleyin</p>
            </div>
            <HscrollArrows>
              <div className="category-grid hcat-grid">
                {categories.map((c) => (
                  <Link key={c.id} href={`/${c.slug}`} className="hcat-card">
                    <div className="hcat-img-wrap">
                      {c.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt={c.name} className="hcat-img" />
                      )}
                      <div className="hcat-overlay" />
                      <span className="hcat-name">{c.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </HscrollArrows>
          </div>
        </section>
      )}

      <ProductRow title="İndirimli Ürünler" ctaHref="/urunler?saleOnly=true" products={saleProducts} />

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
                ctaHref={item.section.seoSlug ? `/${item.section.seoSlug}` : sectionHref(item.section.algoType)}
                products={item.section.products}
              />
            )}
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

      <JoinCtaSection loggedIn={!!customer} />
      <Advantages />
    </main>
  );
}

// bkz. kullanıcı isteği: "üye ol ayrıcalıkları kaçırma ve sende satıcı ol
// bölümlerini kaldır daha farklı ve daha profesyonel olsun" - "Satıcı Ol"
// kartı kaldırıldı (bu teşvik zaten üst menüde/top-bar'da her sayfada
// kalıcı olarak duruyor, bkz. site-nav.tsx/top-bar.tsx), bölüm tek bir
// "Üye Ol" kartına odaklanıp somut ayrıcalıkları madde madde listeleyen,
// daha zengin bir tasarıma kavuştu. Zaten üye olan bir müşteriye bu bölüm
// hiç gösterilmez.
const MEMBER_PERKS = [
  { icon: "fa-heart", text: "Favori ürünlerini kaydet, istediğin an geri dön" },
  { icon: "fa-truck-fast", text: "Siparişlerini adım adım takip et" },
  { icon: "fa-wand-magic-sparkles", text: "Zevkine göre kişiselleştirilmiş öneriler al" },
  { icon: "fa-tags", text: "Kendi dolabındaki ürünleri satışa çıkar" },
];

function JoinCtaSection({ loggedIn }: { loggedIn: boolean }) {
  if (loggedIn) return null;
  return (
    <section className="join-cta-section">
      <div className="container">
        <div className="join-cta-card-wide">
          <div className="join-cta-wide-text">
            <span className="join-cta-eyebrow">Ücretsiz Üyelik</span>
            <h3>Üye Ol, Ayrıcalıkları Kaçırma</h3>
            <ul className="join-cta-perks">
              {MEMBER_PERKS.map((perk) => (
                <li key={perk.text}>
                  <i className={`fas ${perk.icon}`} />
                  <span>{perk.text}</span>
                </li>
              ))}
            </ul>
            <Link href="/kayit" className="btn btn-lg join-cta-btn-light">
              Ücretsiz Üye Ol
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
