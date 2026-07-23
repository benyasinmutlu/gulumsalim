import Link from "next/link";
import VendorRegisterForm from "./register-form";

export default function VendorRegisterPage() {
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
            <h1>Milyonlarca müşteriye ulaşın</h1>
            <p>
              Kayıt sonrası mağazanız &quot;onay bekliyor&quot; durumunda oluşturulur — ürünleriniz admin onayından
              sonra yayınlanır.
            </p>
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
              <Link href="/kayit" className="ga-tab">
                Müşteri Kaydı
              </Link>
              <span className="ga-tab active">Satıcı Kaydı</span>
            </div>

            <h2>Satıcı Olun</h2>
            <p className="ga-sub">Milyonlarca müşteriye ulaşmak için bugün başvurun.</p>

            <VendorRegisterForm />

            <div className="ga-footer">
              Zaten satıcı mısınız? <Link href="/satici/giris">Giriş Yapın</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
