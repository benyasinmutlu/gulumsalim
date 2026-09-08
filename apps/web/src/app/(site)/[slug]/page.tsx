import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch, apiFetchJson } from "@/lib/api";
import { SITE_ORIGIN } from "@/lib/env";
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
import LegalPagePrintButton from "@/components/legal-page-print-button";

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

function slugifyHeading(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// docs/ klasöründeki hukuki belgelerin (KVKK, Gizlilik Politikası vb.)
// hepsi `<h3>` ile numaralı bölümlere ayrılmış olarak geliyor (bkz. admin
// panelden girilen page.content). Bu bölümlere çapa (anchor) id'si ekleyip
// tıklanabilir bir "İçindekiler" listesi çıkarır - kısa sayfalarda (tek
// bölüm) gereksiz olduğu için en az 2 başlık şart koşulur.
function buildTableOfContents(html: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const usedIds = new Set<string>();
  const annotated = html.replace(/<h3>(.*?)<\/h3>/g, (_match, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = slugifyHeading(text) || `bolum-${toc.length + 1}`;
    while (usedIds.has(id)) id = `${id}-${toc.length + 1}`;
    usedIds.add(id);
    toc.push({ id, text });
    return `<h3 id="${id}">${inner}</h3>`;
  });
  return { html: annotated, toc: toc.length >= 2 ? toc : [] };
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

// bkz. kullanıcı isteği: "çocukta erkek ve kız olarak ayrılacak açılan
// sayfa teması erkekte toz mavi kızda toz pembe olacak" - sadece bu iki
// alt kategori sayfası tema alır, sitenin geri kalanı monokrom kalır.
function categoryThemeClass(slug: string): string | undefined {
  if (slug === "erkek-cocuk") return "theme-boy";
  if (slug === "kiz-cocuk") return "theme-girl";
  return undefined;
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

// bkz. denetim raporu: canonical URL, OG, boş kategori noindex politikası
// hiçbirinde yoktu - sadece bir <title> dönülüyordu. `/{slug}` hem kategori
// hem mağaza hem CMS sayfası hem anasayfa bölümü olabildiği için (aynı ad
// alanını paylaşırlar, bkz. isSeoSlugTaken yorumu) canonical her zaman
// KENDİ temiz URL'i - ikinci bir erişim yolu yok, ama ileride slug
// değişirse/aynı içeriğe iki path'ten erişilirse diye açıkça belirtiliyor.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `${SITE_ORIGIN}/${slug}`;
  const page = await getPage(slug);
  if (page) {
    return {
      title: `${page.title} | Gülüm Şalım`,
      alternates: { canonical },
    };
  }
  const vendorTitle = await getVendorMetaTitle(slug);
  if (vendorTitle) {
    return {
      title: `${vendorTitle} | Gülüm Şalım`,
      description: `${vendorTitle} mağazasının ürünlerini Gülüm Şalım'da keşfedin.`,
      alternates: { canonical },
      openGraph: { title: vendorTitle, type: "website", url: canonical },
    };
  }
  const section = await getSectionBySlug(slug);
  if (section) {
    return {
      title: `${section.title} | Gülüm Şalım`,
      alternates: { canonical },
    };
  }
  const category = await findCategoryBySlug(slug);
  if (category) {
    // bkz. denetim raporu: "Boş kategori index politikası" - 0 ürünlü bir
    // kategori sayfası arama motoruna gerçek içerik vaat edip boş çıkmasın.
    let hasProducts = true;
    try {
      const result = await apiFetchJson<{ items: unknown[] }>(`/products?category=${category.slug}&limit=1`);
      hasProducts = result.items.length > 0;
    } catch {
      hasProducts = true; // API geçiciyse yanlışlıkla noindex'e düşme
    }
    return {
      title: `${category.name} | Gülüm Şalım`,
      description: `Gülüm Şalım'da ${category.name} kategorisindeki kadın giyim ürünlerini keşfedin.`,
      alternates: { canonical },
      openGraph: { title: category.name, type: "website", url: canonical },
      ...(hasProducts ? {} : { robots: { index: false, follow: true } }),
    };
  }
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
      // bkz. kullanıcı isteği: "kategoriler sayfalar ... çok önemli bunlar"
      // - kategori sayfasının API'de kendine özel bir ucu olmadığından
      // (bkz. findCategoryBySlug - tüm kategori listesinden slug'a göre
      // filtreleniyor), görüntülenme genel /analytics/track ucuna sunucu
      // tarafından bildirilir.
      apiFetch("/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "category", contentId: category.id, eventType: "view" }),
      }).catch(() => {});
      return (
        <ProductListing
          params={{ ...query, category: category.slug }}
          heading={category.name}
          basePath={`/${category.slug}`}
          lockedCategorySlug={category.slug}
          themeClass={categoryThemeClass(category.slug)}
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
                <p>{settings.footer_about || "Kadın modasının yeni nesil pazaryeri. Butikleri ve mağazaları tek bir platformda keşfedin."}</p>
              </div>
              <div className="about-features">
                <div className="about-feature-card">
                  <i className="fas fa-shield-halved" />
                  <h3>Güvenli Ödeme</h3>
                  <p>iyzico altyapısıyla 256-bit şifreli, güvenli ödeme.</p>
                </div>
                <div className="about-feature-card">
                  <i className="fas fa-store" />
                  <h3>Onaylı Mağazalar</h3>
                  <p>Platformumuza katılan mağazalar belirlenen kayıt ve doğrulama süreçlerinden geçer.</p>
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

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, margin: "40px 0" }}>
                <div className="about-feature-card" style={{ textAlign: "left" }}>
                  <i className="fas fa-store" />
                  <h3>Mağazanızı Dijitale Taşıyın</h3>
                  <p>
                    Gülüm Şalım, butiklerin, mağazaların, markaların ve girişimcilerin ürünlerini dijital ortamda sergileyerek daha geniş
                    müşteri kitlelerine ulaşabilmelerini hedefler. Satıcılarımız kendi mağazalarını oluşturabilir, ürünlerini sergileyebilir
                    ve siparişlerini platform üzerinden yönetebilir.
                  </p>
                  <Link href="/satici/kayit" className="btn btn-primary btn-lg" style={{ marginTop: 12 }}>
                    Satıcı Ol
                  </Link>
                </div>
                <div className="about-feature-card" style={{ textAlign: "left" }}>
                  <i className="fas fa-magnifying-glass" />
                  <h3>Tarzınızı Tek Bir Yerde Keşfedin</h3>
                  <p>
                    Farklı mağazaların ürünlerini tek bir platformda keşfedin. Kategori, beden, renk, fiyat ve tarz seçenekleri arasından
                    size uygun ürünleri bulun, favorilerinizi oluşturun ve alışverişinizi kolayca tamamlayın. Gülüm Şalım&apos;da alışveriş
                    deneyiminin kolay, güvenilir ve keyifli olması temel önceliklerimizden biridir.
                  </p>
                  <Link href="/urunler" className="btn btn-secondary btn-lg" style={{ marginTop: 12 }}>
                    Alışverişe Başla
                  </Link>
                </div>
              </div>

              <div style={{ margin: "40px 0" }}>
                <h3 style={{ marginBottom: 10 }}>Kadın Modasının Dijital Buluşma Noktası</h3>
                <p style={{ lineHeight: 1.8, color: "var(--color-text-light)" }}>
                  Vizyonumuz; Türkiye&apos;de kadın modası denildiğinde akla gelen güçlü dijital pazaryerlerinden biri olmak, mağazaların
                  dijital dünyada büyümesine katkı sağlarken müşterilerimize zengin ürün çeşitliliği ve güçlü bir alışveriş deneyimi
                  sunmaktır. Gülüm Şalım büyüdükçe mağazalarımızın, ürün çeşitliliğimizin ve kullanıcı topluluğumuzun da birlikte büyüdüğü
                  sürdürülebilir bir moda ekosistemi oluşturmayı hedefliyoruz.
                </p>
              </div>

              <div style={{ margin: "40px 0" }}>
                <h3 style={{ marginBottom: 10 }}>Teknolojiyle Gelişen Moda</h3>
                <p style={{ lineHeight: 1.8, color: "var(--color-text-light)" }}>
                  Gülüm Şalım&apos;ı yalnızca bugünün değil, geleceğin alışveriş deneyimini düşünerek geliştiriyoruz. Ürün çeşitliliğimiz ve
                  kullanıcı topluluğumuz büyüdükçe kişiselleştirilmiş ürün keşfi, akıllı öneriler ve yapay zekâ destekli kombin ve stil
                  çözümleri gibi yeni teknolojileri platformumuza kazandırmayı hedefliyoruz.
                </p>
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: "36px 24px",
                  borderRadius: 16,
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark, var(--color-primary)) 100%)",
                  color: "#fff",
                }}
              >
                <h3 style={{ color: "#fff", marginBottom: 8 }}>Gülüm Şalım&apos;da yerinizi alın</h3>
                <p style={{ color: "rgba(255,255,255,.9)", marginBottom: 20 }}>
                  İster yeni tarzları keşfedin, ister mağazanızı yeni müşterilerle buluşturma yolculuğuna başlayın.
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href="/urunler" className="btn btn-lg join-cta-btn-light">
                    Alışverişe Başla
                  </Link>
                  <Link href="/satici/kayit" className="btn btn-lg btn-secondary">
                    Satıcı Ol
                  </Link>
                </div>
              </div>
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
            (() => {
              const { html, toc } = buildTableOfContents(page.content);
              return (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 8 }}>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>{page.title}</h1>
                    <div className="hide-on-print" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-light)" }}>
                        Son güncelleme: {formatUpdatedAt(page.updatedAt)}
                      </span>
                      <LegalPagePrintButton />
                    </div>
                  </div>

                  {toc.length > 0 && (
                    <nav
                      className="hide-on-print"
                      aria-label="İçindekiler"
                      style={{
                        margin: "20px 0",
                        padding: "16px 20px",
                        background: "rgba(204,124,148,.04)",
                        border: "1px solid rgba(204,124,148,.15)",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--color-primary)" }}>
                        <i className="fas fa-list" /> İçindekiler
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, columns: toc.length > 6 ? 2 : 1, fontSize: 13, lineHeight: 1.9 }}>
                        {toc.map((item) => (
                          <li key={item.id}>
                            <a href={`#${item.id}`}>{item.text}</a>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  )}

                  {/* page.content admin panelinden zengin metin (HTML) olarak geliyor -
                      eski sitede de page.php aynı şekilde ham HTML olarak basıyordu. */}
                  <div
                    style={{
                      lineHeight: 1.8,
                      color: "var(--color-text-light)",
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,.06)",
                      borderRadius: 14,
                      padding: "28px 32px",
                      boxShadow: "0 4px 24px rgba(0,0,0,.04)",
                    }}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                </>
              );
            })()
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
