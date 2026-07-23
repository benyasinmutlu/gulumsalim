import Link from "next/link";
import { apiFetchJson, publicFetchJson } from "@/lib/api";
import type {
  AdminPromoBanner,
  AdminSlider,
  Category,
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

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
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

async function getPromoBanners(): Promise<AdminPromoBanner[]> {
  try {
    return await apiFetchJson<AdminPromoBanner[]>("/promo-banners");
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

// gulumsalim.com anasayfasının ("index.php") bölüm sırasının birebir
// karşılığı: hero → trust-strip → (keşfet/kişiselleştirilmiş ürün satırı) →
// kategoriler → kampanya bannerları (başlıksız/kutusuz "plain" stil) →
// indirimli ürünler → admin'in kurduğu ek bölümler → "Tüm Koleksiyonu Gör" →
// Avantajlarımız. Her ürün satırı eski sitedeki gibi bir
// "section-scroll-shell" kutusu içinde, yatay kaydırılabilir (hscroll).
function ProductRow({
  title,
  subtitle,
  titleColor,
  ctaHref,
  products,
}: {
  title: string;
  subtitle?: string | null;
  titleColor?: string | null;
  ctaHref?: string | null;
  products: ProductListItem[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="products-section">
      <div className="container">
        <div className="section-scroll-shell">
          <div className="section-header section-header-flex">
            <div>
              <h2 className="section-title" style={{ color: titleColor ?? undefined }}>
                {title}
              </h2>
              {subtitle && <p className="section-subtitle">{subtitle}</p>}
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

async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await publicFetchJson<SiteSettings>("/site-settings");
  } catch {
    return {};
  }
}

export default async function Home() {
  const [categories, sliders, promoBanners, discover, sections, saleProducts, homepageCollections, settings] = await Promise.all([
    getCategories(),
    getSliders(),
    getPromoBanners(),
    getDiscoverFeed(),
    getHomepageSections(),
    getSaleProducts(),
    getHomepageCollections(),
    getSiteSettings(),
  ]);
  const heroIntervalMs = settings.hero_interval_ms ? Number(settings.hero_interval_ms) : undefined;

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

      <ProductRow
        title={discover.strategy === "personalized" ? "Senin İçin" : "Beğenebileceğin Ürünler"}
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
                  <Link key={c.id} href={`/kategori/${c.slug}`} className="hcat-card">
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

      {promoBanners.length > 0 && (
        <section className="products-section promo-section-plain">
          <div className="container">
            <div className="promo-grid">
              {promoBanners.map((b) => (
                <Link key={b.id} href={b.linkUrl || "/urunler"} className="promo-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="promo-card-img" src={b.image} alt={b.title} />
                  <div className="promo-card-overlay" />
                  <div className="promo-content" style={{ color: b.textColor ?? undefined }}>
                    <h3 style={{ color: b.textColor ?? undefined }}>{b.title}</h3>
                    {b.subtitle && <p>{b.subtitle}</p>}
                    {b.buttonText && <span className="btn btn-sm btn-primary promo-cta">{b.buttonText}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <ProductRow title="İndirimli Ürünler" ctaHref="/urunler?saleOnly=true" products={saleProducts} />

      {sections.map((section) => (
        <ProductRow
          key={section.id}
          title={section.title}
          subtitle={section.subtitle}
          titleColor={section.titleColor}
          ctaHref={sectionHref(section.algoType)}
          products={section.products}
        />
      ))}

      <div className="container" style={{ textAlign: "center", margin: "-20px 0 40px" }}>
        <Link href="/urunler" className="btn btn-secondary btn-lg">
          Tüm Koleksiyonu Gör
        </Link>
      </div>

      {homepageCollections.map((col) => (
        <ProductRow
          key={`hc-${col.id}`}
          title={col.title}
          subtitle={col.subtitle}
          titleColor={col.textColor}
          ctaHref={col.linkUrl}
          products={col.products}
        />
      ))}

      <Advantages />
    </main>
  );
}
