import Link from "next/link";
import type { Metadata } from "next";
import VendorLoginForm from "./login-form";
import { getSiteStats } from "@/lib/site-stats";
import { formatStatCount } from "@/lib/format-stat-count";

export const metadata: Metadata = { title: "Kurumsal Üye Girişi | Gülüm Şalım" };

export default async function VendorLoginPage() {
  const stats = await getSiteStats();
  const buyerPhrase = stats.customers > 0 ? `${formatStatCount(stats.customers)} alıcıya anında ulaş` : "Alıcılara anında ulaş";
  return (
    <>
      <Link href="/" className="ga-back">
        <i className="fas fa-arrow-left" /> Ana Sayfa
      </Link>
      <div className="ga-wrap ga-photo-panel ga-vendor-photo-panel">
        <div className="ga-visual">
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
          </div>
          <div className="ga-visual-bottom">
            <span className="hero-tag">Kurumsal Panel</span>
            <h1>Mağazanızı yönetmeye devam edin</h1>
            <p>Satıcı panelinizden ürünlerinizi, siparişlerinizi ve kazançlarınızı takip edin — {buyerPhrase.toLocaleLowerCase("tr-TR")}.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <div className="ga-tabs">
              <Link href="/giris" className="ga-tab">
                Bireysel Üye Girişi
              </Link>
              <span className="ga-tab active">Kurumsal Üye Girişi</span>
            </div>

            <h2>Kurumsal Üye Girişi</h2>
            <p className="ga-sub">Mağaza ve satıcı panelinize erişmek için giriş yapın.</p>

            <VendorLoginForm />

            <div className="ga-footer">
              Henüz kurumsal üye değil misiniz? <Link href="/satici/kayit">Ücretsiz Başvurun</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
