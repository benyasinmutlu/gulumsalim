import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterForm from "./register-form";

export const metadata: Metadata = { title: "Bireysel Üyelik | Gülüm Şalım" };

// gulumsalim.com'daki register.php'nin (ga-* tasarım sistemi) karşılığı.
// Satıcı kaydı zaten ayrı bir sayfada (/satici/kayit) olduğu için "Satıcı
// Kaydı" sekmesi oraya yönlendirir.
export default function RegisterPage() {
  return (
    <>
      <Link href="/" className="ga-back">
        <i className="fas fa-arrow-left" /> Ana Sayfa
      </Link>
      <div className="ga-wrap ga-photo-panel">
        <div className="ga-visual">
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
          </div>
          <div className="ga-visual-bottom">
            <span className="hero-tag">Vintage &amp; Özgün Seçkiler</span>
            <h1>Ailemize katılın, tarzınızı keşfedin</h1>
            <p>Üye olun; favori ürünleriniz, sipariş takibiniz ve size özel önerileriniz burada.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <div className="ga-tabs">
              <span className="ga-tab active">Bireysel Üyelik</span>
              <Link href="/satici/kayit" className="ga-tab">
                Kurumsal Üyelik
              </Link>
            </div>

            <h2>Bireysel Üye Olun</h2>
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
