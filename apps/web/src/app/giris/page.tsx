import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Bireysel Üye Girişi | Gülüm Şalım" };

// gulumsalim.com'daki login.php'nin (ga-* tasarım sistemi) birebir
// karşılığı: sol tarafta marka görseli + avantaj listesi, sağda sekmeli
// (Müşteri/Satıcı) giriş formu. Satıcı girişi zaten ayrı bir sayfada
// (/satici/giris) olduğu için buradaki "Satıcı Girişi" sekmesi oraya
// yönlendirir.
export default function LoginPage() {
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
            <h1>Tarzınıza kaldığınız yerden devam edin</h1>
            <p>Favori ürünleriniz, siparişleriniz ve size özel önerileriniz sizi bekliyor.</p>
            <div className="ga-perks">
              <div className="ga-perk">
                <i className="fas fa-shipping-fast" /> Hızlı ve güvenilir kargo
              </div>
              <div className="ga-perk">
                <i className="fas fa-undo" /> 14 gün koşulsuz iade
              </div>
              <div className="ga-perk">
                <i className="fas fa-shield-alt" /> Güvenli ödeme altyapısı
              </div>
            </div>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <div className="ga-tabs">
              <span className="ga-tab active">Bireysel Üye Girişi</span>
              <Link href="/satici/giris" className="ga-tab">
                Kurumsal Üye Girişi
              </Link>
            </div>

            <h2>Tekrar Hoş Geldiniz</h2>
            <p className="ga-sub">Hesabınıza giriş yapın ve alışverişe devam edin.</p>

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>

            <div className="ga-footer">
              Henüz bireysel üye değil misiniz? <Link href="/kayit">Hemen Kayıt Ol</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
