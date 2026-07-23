import Link from "next/link";
import VendorLoginForm from "./login-form";

export default function VendorLoginPage() {
  return (
    <>
      <Link href="/" className="ga-back">
        <i className="fas fa-arrow-left" /> Ana Sayfa
      </Link>
      <div className="ga-wrap">
        <div className="ga-visual">
          <div className="ga-orb ga-orb1" />
          <div className="ga-orb ga-orb2" />
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-icon">🌸</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>Mağazanızı yönetmeye devam edin</h1>
            <p>Satıcı panelinizden ürünlerinizi, siparişlerinizi ve kazançlarınızı takip edin.</p>
            <div className="ga-perks">
              <div className="ga-perk">
                <i className="fas fa-store" /> Binlerce alıcıya anında ulaş
              </div>
              <div className="ga-perk">
                <i className="fas fa-bolt" /> Dakikalar içinde kurulan satıcı paneli
              </div>
              <div className="ga-perk">
                <i className="fas fa-wallet" /> Hızlı ve güvenli ödeme akışı
              </div>
            </div>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <div className="ga-tabs">
              <Link href="/giris" className="ga-tab">
                Müşteri Girişi
              </Link>
              <span className="ga-tab active">Satıcı Girişi</span>
            </div>

            <h2>Satıcı Girişi</h2>
            <p className="ga-sub">Satıcı panelinize erişmek için giriş yapın.</p>

            <VendorLoginForm />

            <div className="ga-footer">
              Henüz satıcı değil misiniz? <Link href="/satici/kayit">Ücretsiz Başvurun</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
