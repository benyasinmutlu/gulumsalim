import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "E-posta Doğrulama | Gülüm Şalım" };

interface Props {
  searchParams: Promise<{ status?: string; role?: string }>;
}

export default async function EmailVerificationResultPage({ searchParams }: Props) {
  const { status, role } = await searchParams;
  const ok = status === "ok";
  const loginHref = role === "satici" ? "/satici/giris" : "/giris";

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
            <h1>E-posta Doğrulama</h1>
            <p>Hesabınızın e-posta adresi doğrulama durumu.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            {ok ? (
              <div className="ga-alert" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
                <i className="fas fa-circle-check" /> E-posta adresiniz doğrulandı. Artık giriş yapabilirsiniz.
              </div>
            ) : (
              <div className="ga-alert">
                <i className="fas fa-exclamation-circle" /> Bağlantının süresi dolmuş veya geçersiz. Giriş ekranından yeni bir doğrulama
                e-postası isteyebilirsiniz.
              </div>
            )}
            <Link href={loginHref} className="ga-submit" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
              Girişe Dön
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
