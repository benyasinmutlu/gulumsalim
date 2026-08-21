import Link from "next/link";
import type { Metadata } from "next";
import VendorForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi Unuttum | Gülüm Şalım Satıcı Paneli" };

export default function VendorForgotPasswordPage() {
  return (
    <>
      <Link href="/satici/giris" className="ga-back">
        <i className="fas fa-arrow-left" /> Girişe Dön
      </Link>
      <div className="ga-wrap">
        <div className="ga-visual">
          <div className="ga-orb ga-orb1" />
          <div className="ga-orb ga-orb2" />
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-icon">GS</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>Şifrenizi mi unuttunuz?</h1>
            <p>Satıcı hesabınızın e-posta adresine birkaç dakika içinde bir sıfırlama bağlantısı gönderelim.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <h2>Şifremi Unuttum</h2>
            <p className="ga-sub">Satıcı hesabınıza kayıtlı e-posta adresini girin.</p>

            <VendorForgotPasswordForm />

            <div className="ga-footer">
              Şifrenizi hatırladınız mı? <Link href="/satici/giris">Giriş Yap</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
