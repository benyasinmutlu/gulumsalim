import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch, apiFetchJson } from "@/lib/api";
import type { Category, ResolvedHomepageSection, SiteSettings } from "@/lib/types";
import ContactForm from "./contact-form";
import VendorStorefrontView, { getVendorMetaTitle } from "@/components/vendor-storefront";
import ProductCard from "@/components/product-card";
import PromoBannerImage from "@/components/promo-banner-image";
import PromoBannerLink from "@/components/promo-banner-link";
import PromoBannerImpression from "@/components/promo-banner-impression";
import ProductListing, { type ProductListingParams } from "@/components/product-listing";
import { CategoryNavSync } from "@/components/category-nav-context";
import ScrollReveal from "@/components/scroll-reveal";
import TitleBackgroundIcons from "@/components/title-background-icons";
import { sectionIcon } from "@/lib/title-icon";

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProductListingParams>;
}

async function getAllCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getAllCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

async function getPage(slug: string): Promise<CmsPage | null> {
  const res = await apiFetch(`/pages/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await apiFetchJson<SiteSettings>("/site-settings");
  } catch {
    return {};
  }
}

interface CurrentCustomer {
  fullName: string;
  email: string;
}

async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

async function getSectionBySlug(slug: string): Promise<ResolvedHomepageSection | null> {
  const res = await apiFetch(`/homepage-sections/by-slug/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (page) return { title: `${page.title} | Gülüm Şalım` };
  const vendorTitle = await getVendorMetaTitle(slug);
  if (vendorTitle) return { title: `${vendorTitle} | Gülüm Şalım` };
  const section = await getSectionBySlug(slug);
  if (section) return { title: `${section.title} | Gülüm Şalım` };
  const category = await findCategoryBySlug(slug);
  if (category) return { title: `${category.name} | Gülüm Şalım` };
  return { title: "Sayfa bulunamadı" };
}

// homepage-sections.php'deki seo_slug'ın karşılığı - bir anasayfa bölümü
// SEO adresi aldığında, homepage satırının yanı sıra kök seviyede kendi
// tam listeleme sayfasını da alır.
async function SectionPage({ section }: { section: ResolvedHomepageSection }) {
  const allCategories = await getAllCategories();
  const resultCategorySlugs = new Set(section.products.map((p) => p.categorySlug));
  const resultCategories = allCategories.filter((c) => resultCategorySlugs.has(c.slug));

  return (
    <main className="main-content">
      <CategoryNavSync categories={resultCategories} />
      <TitleBackgroundIcons icon={sectionIcon(section.algoType)} />
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">{section.title}</span>
          </div>
        </div>
      </div>
      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h1 className="page-title">{section.title}</h1>
            {section.subtitle && <p className="section-subtitle">{section.subtitle}</p>}
          </div>
          {section.algoType === "promo_banners" ? (
            <div className={section.bannerLayout === "stack" ? "promo-stack" : "promo-grid"}>
              {(section.banners ?? []).map((b) => {
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
          ) : section.products.length === 0 ? (
            <p className="empty-state">Bu bölümde henüz ürün yok.</p>
          ) : (
            <div className="product-grid">
              {section.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// gulumsalim.com'daki kök seviyeli temiz URL'lerin (.htaccess yakalayıcı
// kuralları) karşılığı: önce admin'in yazdığı bir CMS sayfası (hakkımızda,
// iletişim vb.) aranır, bulunamazsa bir mağaza (eskiden /magaza/{slug},
// artık kalıcı olarak buraya taşındı) aranır, o da yoksa admin'in SEO
// adresi verdiği bir anasayfa bölümü, o da yoksa bir kategori aranır
// (eskiden /kategori/{slug} - bkz. kullanıcı isteği: "/kategori/elbiseler
// şeklinde olmasın direkt /elbiseler olsun") - hiçbiri yoksa 404.
export default async function CatchAllRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    const query = await searchParams;
    const storefront = await VendorStorefrontView({ slug, cursor: query.cursor });
    if (storefront) return storefront;
    const section = await getSectionBySlug(slug);
    if (section) return <SectionPage section={section} />;
    const category = await findCategoryBySlug(slug);
    if (category) {
      return (
        <ProductListing
          params={{ ...query, category: category.slug }}
          heading={category.name}
          basePath={`/${category.slug}`}
          lockedCategorySlug={category.slug}
        />
      );
    }
    notFound();
  }

  const settings = slug === "iletisim" || slug === "hakkimizda" ? await getSiteSettings() : {};
  const customer = slug === "iletisim" ? await getCurrentCustomer() : null;

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">{page.title}</span>
          </div>
        </div>
      </div>

      <section className="about-section">
        <div className="container" style={{ maxWidth: slug === "hakkimizda" || slug === "iletisim" ? 1100 : 760 }}>
          {/* bkz. kullanıcı isteği: "Hakkımızda ve iletişim kısımlarını çok
              daha güzel profesyonel yapalım" - .about-hero/.about-features
              CSS'i zaten globals.css'te hazırdı ama hiçbir sayfa kullanmıyordu,
              ikisi de düz <h1>+ham HTML gösteriyordu. */}
          {slug === "hakkimizda" ? (
            <>
              <div className="about-hero">
                <h1>{settings.site_name || "Gülüm Şalım"}</h1>
                <p>{settings.footer_about || "Türkiye'nin butik moda pazar yeri — yüzlerce satıcı, binlerce ürün, tek adres."}</p>
              </div>
              <div className="about-features">
                <div className="about-feature-card">
                  <i className="fas fa-shield-halved" />
                  <h3>Güvenli Ödeme</h3>
                  <p>iyzico altyapısıyla 256-bit şifreli, güvenli ödeme.</p>
                </div>
                <div className="about-feature-card">
                  <i className="fas fa-store" />
                  <h3>Doğrulanmış Satıcılar</h3>
                  <p>Her mağaza incelemeden geçer, siz güvenle alışveriş yapın.</p>
                </div>
                <div className="about-feature-card">
                  <i className="fas fa-truck-fast" />
                  <h3>Hızlı Kargo</h3>
                  <p>Siparişiniz onaylanan satıcı tarafından hızla kargoya verilir.</p>
                </div>
                <div className="about-feature-card">
                  <i className="fas fa-headset" />
                  <h3>Destek Hattı</h3>
                  <p>Sorularınız için satıcıya doğrudan ulaşın, biz de yanınızdayız.</p>
                </div>
              </div>
              <div style={{ lineHeight: 1.8, color: "var(--color-text-light)" }} dangerouslySetInnerHTML={{ __html: page.content }} />
            </>
          ) : slug === "iletisim" ? (
            <>
              <div className="about-hero" style={{ marginBottom: 40 }}>
                <h1>{page.title}</h1>
                <div style={{ lineHeight: 1.8, color: "var(--color-text-light)" }} dangerouslySetInnerHTML={{ __html: page.content }} />
              </div>
              <ContactSection settings={settings} customer={customer} />
            </>
          ) : (
            <>
              <h1 className="page-title">{page.title}</h1>
              {/* page.content admin panelinden zengin metin (HTML) olarak geliyor -
                  eski sitede de page.php aynı şekilde ham HTML olarak basıyordu. */}
              <div style={{ lineHeight: 1.8, color: "var(--color-text-light)" }} dangerouslySetInnerHTML={{ __html: page.content }} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

// gulumsalim.com'daki admin/settings.php > İletişim Sayfası sekmesinin
// karşılığı - admin panelden girilen giriş metni/çalışma saatleri/telefon/
// e-posta, iletişim formunun üstünde kart olarak gösterilir.
function ContactSection({ settings, customer }: { settings: SiteSettings; customer: CurrentCustomer | null }) {
  const hasInfo = settings.contact_intro || settings.contact_hours || settings.site_phone || settings.site_email;
  return (
    <div style={{ marginTop: 24 }}>
      {hasInfo && (
        <div className="contact-grid" style={{ marginBottom: 24 }}>
          <div>
            {settings.contact_intro && <p style={{ marginBottom: 16 }}>{settings.contact_intro}</p>}
            {settings.site_phone && (
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <i className="fas fa-phone" />
                </div>
                <div className="contact-info-text">
                  <h4>Telefon</h4>
                  <p>{settings.site_phone}</p>
                </div>
              </div>
            )}
            {settings.site_email && (
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <i className="fas fa-envelope" />
                </div>
                <div className="contact-info-text">
                  <h4>E-posta</h4>
                  <p>{settings.site_email}</p>
                </div>
              </div>
            )}
            {settings.contact_hours && (
              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <i className="fas fa-clock" />
                </div>
                <div className="contact-info-text">
                  <h4>Çalışma Saatleri</h4>
                  <p>{settings.contact_hours}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <ContactForm initialName={customer?.fullName} initialEmail={customer?.email} />
    </div>
  );
}
