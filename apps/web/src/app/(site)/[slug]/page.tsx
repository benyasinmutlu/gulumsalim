import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch, apiFetchJson } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";
import ContactForm from "./contact-form";
import VendorStorefrontView, { getVendorMetaTitle } from "@/components/vendor-storefront";

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (page) return { title: `${page.title} | Gülüm Şalım` };
  const vendorTitle = await getVendorMetaTitle(slug);
  if (vendorTitle) return { title: `${vendorTitle} | Gülüm Şalım` };
  return { title: "Sayfa bulunamadı" };
}

// gulumsalim.com'daki kök seviyeli temiz URL'lerin (.htaccess yakalayıcı
// kuralları) karşılığı: önce admin'in yazdığı bir CMS sayfası (hakkımızda,
// iletişim vb.) aranır, bulunamazsa bir mağaza (eskiden /magaza/{slug},
// artık kalıcı olarak buraya taşındı) aranır - o da yoksa 404.
// Kategoriler artık ayrı bir rotada (bkz. kategori/[slug]/page.tsx).
export default async function CatchAllRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    const { cursor } = await searchParams;
    const storefront = await VendorStorefrontView({ slug, cursor });
    if (storefront) return storefront;
    notFound();
  }

  const settings = slug === "iletisim" ? await getSiteSettings() : {};

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
        <div className="container" style={{ maxWidth: 760 }}>
          <h1 className="page-title">{page.title}</h1>
          {/* page.content admin panelinden zengin metin (HTML) olarak geliyor -
              eski sitede de page.php aynı şekilde ham HTML olarak basıyordu. */}
          <div style={{ lineHeight: 1.8, color: "var(--color-text-light)" }} dangerouslySetInnerHTML={{ __html: page.content }} />
          {slug === "iletisim" && <ContactSection settings={settings} />}
        </div>
      </section>
    </main>
  );
}

// gulumsalim.com'daki admin/settings.php > İletişim Sayfası sekmesinin
// karşılığı - admin panelden girilen giriş metni/çalışma saatleri/telefon/
// e-posta, iletişim formunun üstünde kart olarak gösterilir.
function ContactSection({ settings }: { settings: SiteSettings }) {
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
      <ContactForm />
    </div>
  );
}
