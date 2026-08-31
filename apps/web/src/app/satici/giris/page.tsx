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
      <div className="ga-wrap">
        <div className="ga-visual">
          <div className="ga-orb ga-orb1" />
          <div className="ga-orb ga-orb2" />
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-icon">GS</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>Mağazanızı yönetmeye devam edin</h1>
            <p>Satıcı panelinizden ürünlerinizi, siparişlerinizi ve kazançlarınızı takip edin.</p>
            <div className="ga-perks">
              <div className="ga-perk">
                <i className="fas fa-store" /> {buyerPhrase}
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
