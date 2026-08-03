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
      {/* bkz. kullanıcı isteği (2026-08-02): "footer'ın üstündeki bültenimize
          katıl ve kampanya bannerlarını kaldır" - anasayfada zaten daha
          estetik/gezinme-içi bir bülten kartı var (bkz. newsletter-banner.tsx),
          footer'daki bu düz şerit kaldırıldı. */}
      <div className="footer-top">
        <div className="container footer-grid">
          <div className="footer-col">
            <Link href="/" className="footer-logo">
              <span className="logo-icon">🌸</span>
              <span className="logo-text">{settings.site_name || "Gülüm Şalım"}</span>
            </Link>
            <p className="footer-desc">{settings.footer_about || "Gülüm Şalım — Türkiye'nin pazar yeri"}</p>
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
            </div>
            <div
              style={{
                marginTop: 20,
                padding: 14,
                background: "rgba(204,124,148,.06)",
                border: "1px solid rgba(204,124,148,.15)",
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
                <Link href="/urunler?sort=newest">Yeni Gelenler</Link>
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
                <i className="fab fa-cc-visa" />
                <i className="fab fa-cc-mastercard" />
                {/* Resmi marka görselleri - iyzico ve Troy'un kendi marka
                    kitlerinden indirilip self-host edildi (bkz. kullanıcı
                    isteği: "iyzico'nun ve troy'un resmi görselini ekle").
                    Daha önce iyzico'nun kendi CDN'inden hotlink edilen görsel
                    404 vermişti (bkz. globals.css .troy-badge/.iyzico-badge
                    yorumu) - bu yüzden dosyalar public/'e kopyalanıp
                    kendi sunucumuzdan servis ediliyor, dış bağımlılık yok. */}
                <img src="/payment-badges/iyzico.svg" alt="iyzico ile öde" className="payment-badge-img" style={{ height: 20 }} />
                <img src="/payment-badges/troy.svg" alt="Troy" className="payment-badge-img" style={{ height: 20 }} />
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
