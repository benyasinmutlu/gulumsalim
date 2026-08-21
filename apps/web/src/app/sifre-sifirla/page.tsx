import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = { title: "Şifre Sıfırla | Gülüm Şalım" };

export default function ResetPasswordPage() {
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
              <div className="ga-brand-icon">GS</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>Yeni bir şifre belirleyin</h1>
            <p>Hesabınız için güvenli bir şifre seçin.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <h2>Şifre Sıfırla</h2>
            <p className="ga-sub">Yeni şifrenizi girin.</p>

            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
