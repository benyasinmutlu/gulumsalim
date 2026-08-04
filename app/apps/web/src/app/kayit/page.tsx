import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterForm from "./register-form";

export const metadata: Metadata = { title: "Üye Kayıt Ol | Gülüm Şalım" };

// gulumsalim.com'daki register.php'nin (ga-* tasarım sistemi) karşılığı.
// Satıcı kaydı zaten ayrı bir sayfada (/satici/kayit) olduğu için "Satıcı
// Kaydı" sekmesi oraya yönlendirir.
export default function RegisterPage() {
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
            <h1>Ailemize katılın, tarzınızı keşfedin</h1>
            <p>Üye olun; favori ürünleriniz, sipariş takibiniz ve size özel önerileriniz burada.</p>
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
              <span className="ga-tab active">Müşteri Kaydı</span>
              <Link href="/satici/kayit" className="ga-tab">
                Satıcı Kaydı
              </Link>
            </div>

            <h2>Hesap Oluştur</h2>
            <p className="ga-sub">Üye olarak sipariş takibinizi kolayca yapın, indirimlerden ilk siz haberdar olun.</p>

            <Suspense fallback={null}>
              <RegisterForm />
            </Suspense>

            <div className="ga-footer">
              Zaten üye misiniz? <Link href="/giris">Giriş Yap</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
