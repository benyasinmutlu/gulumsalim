import Link from "next/link";
import type { Metadata } from "next";
import ForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi Unuttum | Gülüm Şalım" };

export default function ForgotPasswordPage() {
  return (
    <>
      <Link href="/giris" className="ga-back">
        <i className="fas fa-arrow-left" /> Girişe Dön
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
            <h1>Şifrenizi mi unuttunuz?</h1>
            <p>Endişelenmeyin, e-posta adresinize birkaç dakika içinde bir sıfırlama bağlantısı gönderelim.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <h2>Şifremi Unuttum</h2>
            <p className="ga-sub">Hesabınıza kayıtlı e-posta adresini girin.</p>

            <ForgotPasswordForm />

            <div className="ga-footer">
              Şifrenizi hatırladınız mı? <Link href="/giris">Giriş Yap</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
