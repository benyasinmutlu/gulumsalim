"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UnreadBadge from "./unread-badge";

const MORE_LINKS = [
  { href: "/satici/panel/magaza", label: "Mağaza Profili", icon: "fa-store" },
  { href: "/satici/panel/degerlendirmeler", label: "Değerlendirmeler", icon: "fa-star" },
  { href: "/satici/panel/sorular", label: "Sorular", icon: "fa-question-circle" },
  { href: "/satici/panel/bildirimler", label: "Bildirimler", icon: "fa-bell" },
  { href: "/satici/panel/ayarlar", label: "Ayarlar", icon: "fa-cog" },
];

// bkz. olay: 2026-08-01 "3 çizgiye basınca açılıyorda ... dışarı
// tıkladığımda kapanmıyor" - kök sebep bu tab-bar'ın (position:fixed,
// z-index:90) hamburger'ın açtığı karartma katmanının (overlay,
// satici.css'te "topbar" stacking context'i içinde sıkışıp kalıyor)
// ÜZERİNDE kalması, alt bölgeye dokununca overlay yerine bu çubuğa
// tıklanmış oluyordu. Kalıcı çözüm: bireysel satıcıda mobilde hamburger'ı
// tamamen kaldırıp (bkz. layout.tsx) sidebar'daki geri kalan linkleri bu
// "Daha Fazla" sayfasına taşımak - iki ayrı, çakışan açma/kapama mekanizması
// yerine tek, basit bir tab-bar (bkz. kullanıcı isteği: "arayüzünü daha da
// iyi yapalım").
export default function VendorMobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string) {
    return href === "/satici/panel" ? pathname === href : pathname.startsWith(href);
  }

  const moreActive = MORE_LINKS.some((l) => isActive(l.href));

  return (
    <>
      {moreOpen && <div className="vmn-overlay" onClick={() => setMoreOpen(false)} />}

      {moreOpen && (
        <div className="vmn-sheet">
          <div className="vmn-sheet-head">
            <h4>Daha Fazla</h4>
            <button type="button" aria-label="Kapat" onClick={() => setMoreOpen(false)}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="vmn-sheet-list">
            {MORE_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMoreOpen(false)}>
                <i className={`fas ${l.icon}`} />
                <span>{l.label}</span>
              </Link>
            ))}
            <a href="/api/vendor/auth/logout" className="vmn-sheet-logout">
              <i className="fas fa-sign-out-alt" />
              <span>Çıkış Yap</span>
            </a>
          </div>
        </div>
      )}

      <nav className="vendor-mobile-nav">
        <Link href="/satici/panel" className={`vmn-item${isActive("/satici/panel") ? " is-active" : ""}`}>
          <i className="fas fa-home" />
          <span>Panel</span>
        </Link>
        <Link href="/satici/panel/urunler" className={`vmn-item${isActive("/satici/panel/urunler") ? " is-active" : ""}`}>
          <i className="fas fa-tshirt" />
          <span>Ürünlerim</span>
        </Link>
        <Link href="/satici/panel/urunler/yeni" className="vmn-item vmn-item-add">
          <span className="vmn-add-icon">
            <i className="fas fa-plus" />
          </span>
          <span>Ekle</span>
        </Link>
        <Link href="/satici/panel/siparisler" className={`vmn-item${isActive("/satici/panel/siparisler") ? " is-active" : ""}`}>
          <span className="vmn-icon-wrap">
            <i className="fas fa-shopping-bag" />
            <UnreadBadge kind="pendingOrders" />
          </span>
          <span>Siparişler</span>
        </Link>
        <Link href="/satici/panel/mesajlar" className={`vmn-item${isActive("/satici/panel/mesajlar") ? " is-active" : ""}`}>
          <span className="vmn-icon-wrap">
            <i className="fas fa-envelope" />
            <UnreadBadge kind="messages" />
          </span>
          <span>Mesajlar</span>
        </Link>
        <button type="button" className={`vmn-item${moreOpen || moreActive ? " is-active" : ""}`} onClick={() => setMoreOpen((v) => !v)}>
          <i className="fas fa-ellipsis-h" />
          <span>Daha Fazla</span>
        </button>
      </nav>
    </>
  );
}
