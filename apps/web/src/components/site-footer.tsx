import Link from "next/link";
import { apiFetch } from "../lib/api";
import type { FooterPage, SiteSettings } from "../lib/types";

async function getFooterPages(): Promise<FooterPage[]> {
  const res = await apiFetch("/footer-pages");
  if (!res.ok) return [];
  return res.json();
}

async function getSiteSettings(): Promise<SiteSettings> {
  const res = await apiFetch("/site-settings");
  if (!res.ok) return {};
  return res.json();
}

export default async function SiteFooter() {
  const [footerPages, settings] = await Promise.all([getFooterPages(), getSiteSettings()]);

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="container footer-grid">
          <div className="footer-col">
            <Link href="/" className="footer-logo">
              {settings.site_name || "Gülüm Şalım"}
            </Link>
            {settings.footer_about && <p className="footer-desc">{settings.footer_about}</p>}
            <div className="footer-social">
              {settings.site_instagram && (
                <a href={settings.site_instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  Instagram
                </a>
              )}
              {settings.site_facebook && (
                <a href={settings.site_facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  Facebook
                </a>
              )}
              {settings.site_whatsapp && (
                <a
                  href={`https://wa.me/${settings.site_whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                >
                  WhatsApp
                </a>
              )}
            </div>
            <div
              style={{
                marginTop: 20,
                padding: 14,
                background: "rgba(224,64,160,.06)",
                border: "1px solid rgba(224,64,160,.15)",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", marginBottom: 6 }}>
                <i className="fas fa-store" /> Satıcı Ol
              </div>
              <p style={{ fontSize: 11, color: "var(--color-text-light)", marginBottom: 8 }}>
                Kendi mağazanı aç, ürünlerini sat!
              </p>
              <Link
                href="/satici/kayit"
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "5px 12px",
                  background: "var(--color-primary)",
                  color: "#fff",
                  borderRadius: 6,
                }}
              >
                Başvur →
              </Link>
            </div>
          </div>

          <div className="footer-col">
            <h4>Hızlı Linkler</h4>
            <ul>
              <li>
                <Link href="/urunler">Tüm Ürünler</Link>
              </li>
              <li>
                <Link href="/urunler?saleOnly=true">İndirimli Ürünler</Link>
              </li>
              <li>
                <Link href="/magazalar">Mağazalar</Link>
              </li>
              <li>
                <Link href="/hakkimizda">Hakkımızda</Link>
              </li>
              <li>
                <Link href="/iletisim">İletişim</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Müşteri Hizmetleri</h4>
            <ul>
              <li>
                <Link href="/hesabim">Hesabım</Link>
              </li>
              <li>
                <Link href="/sepet">Sepetim</Link>
              </li>
              {footerPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`}>{p.title}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>İletişim</h4>
            <ul className="footer-contact">
              {settings.site_email && (
                <li>
                  <a href={`mailto:${settings.site_email}`}>{settings.site_email}</a>
                </li>
              )}
              {settings.site_phone && (
                <li>
                  <a href={`tel:${settings.site_phone.replace(/\D/g, "")}`}>{settings.site_phone}</a>
                </li>
              )}
              {settings.site_address && <li>{settings.site_address}</li>}
              <li>Pzt–Cum: 09:00 – 18:00</li>
            </ul>
            <div className="payment-icons">
              <span>Güvenli Ödeme:</span>
              <div className="payment-badges">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="iyzico-badge" src="https://www.iyzico.com/assets/images/content/logo.svg" alt="iyzico" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p>© {new Date().getFullYear()} {settings.site_name || "Gülüm Şalım"}. Tüm hakları saklıdır.</p>
          <div className="footer-admin-links">
            <Link href="/satici/giris">Satıcı Girişi</Link>
            <Link href="/admin/giris">Yönetim</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
