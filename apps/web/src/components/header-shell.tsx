"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category, CustomerProfile } from "../lib/types";
import SearchBox from "./search-box";
import CategoryDropdown from "./category-dropdown";
import NotificationBell from "./notification-bell";
import AccountMenu from "./account-menu";

interface Props {
  categories: Category[];
  customer: CustomerProfile | null;
  cartCount: number;
  favoriteCount?: number;
  siteName?: string;
  siteLogo?: string;
}

// Header + kategori nav'ı birlikte "sticky" kalır, aşağı kaydırınca gizlenir,
// yukarı kaydırınca geri gelir - gulumsalim.com'daki #stickyHeaderWrap
// davranışının birebir karşılığı.
export default function HeaderShell({ categories, customer, cartCount, favoriteCount = 0, siteName, siteLogo }: Props) {
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const lastScrollY = useRef(0);
  const innerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [searchStyle, setSearchStyle] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > lastScrollY.current && y > 120);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // .header-search gerçek sayfa merkezine hizalanır (bkz. kullanıcı isteği:
  // "yatayda tam ortada olsun"), ama logo (~190px) ile ikonlar (~340-460px,
  // giriş yapınca Bildirimler + hesap adı ikonu eklenince genişliyor) FARKLI
  // genişlikte olduğu için sabit bir CSS formülü (calc(100% - 620px)) sadece
  // TEK bir genişlik dengesini varsayabiliyordu - giriş yapıldığında ikon
  // sütunu genişleyip merkezdeki arama kutusunun sağ kenarına taşıyordu
  // (bkz. kullanıcı bildirimi: "giriş yapınca favorilerim search'ün altında
  // kalıyor"). Bunun yerine logo/ikon genişlikleri GERÇEK ZAMANLI ölçülür,
  // arama kutusu her zaman sayfa merkezinde ama iki taraftan taşmayacak
  // kadar (gerekirse 620px'in altına) daraltılarak konumlandırılır.
  useEffect(() => {
    function recompute() {
      const inner = innerRef.current;
      const logo = logoRef.current;
      const actions = actionsRef.current;
      if (!inner || !logo || !actions) return;
      const innerRect = inner.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const actionsRect = actions.getBoundingClientRect();
      const gap = 20;
      const centerX = innerRect.left + innerRect.width / 2;
      const leftLimit = logoRect.right + gap;
      const rightLimit = actionsRect.left - gap;
      const maxHalfWidth = Math.min(centerX - leftLimit, rightLimit - centerX);
      const width = Math.max(200, Math.min(620, maxHalfWidth * 2));
      const left = centerX - width / 2 - innerRect.left;
      setSearchStyle({ left, width });
    }
    recompute();
    window.addEventListener("resize", recompute);
    const ro = new ResizeObserver(recompute);
    if (logoRef.current) ro.observe(logoRef.current);
    if (actionsRef.current) ro.observe(actionsRef.current);
    return () => {
      window.removeEventListener("resize", recompute);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, cartCount, favoriteCount]);

  return (
    <div className={`sticky-header-wrap${hidden ? " header-hidden" : ""}`}>
      <header className="main-header">
        <div className="container header-inner" ref={innerRef}>
          <Link href="/" className="logo" ref={logoRef}>
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt={siteName || "Gülüm Şalım"} className="logo-img" />
            ) : (
              <span className="logo-icon">🌸</span>
            )}
            <span className="logo-text">{siteName || "Gülüm Şalım"}</span>
          </Link>

          <div
            className="header-search"
            style={searchStyle ? { left: searchStyle.left, width: searchStyle.width, transform: "none" } : undefined}
          >
            <SearchBox categories={categories} />
          </div>

          <div className="header-actions" ref={actionsRef}>
            <button
              className="header-icon search-toggle"
              aria-label="Ara"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <i className="fas fa-search" />
            </button>
            {/* bkz. kullanıcı geri bildirimi: "mobildeki headerdaki tüm her
                şey nerdeyse bottom bar navda var" - Favorilerim/Sepet/Hesabım
                mobil alt tab-bar'da zaten var (bkz. mobile-bottom-nav.tsx),
                burada .header-icon-mobile-hide ile <768px'te gizlenir,
                Bildirimler (bottom-nav'da karşılığı yok) ve arama görünür kalır. */}
            <Link href="/hesabim/favoriler" className="header-icon-labeled header-icon-mobile-hide" aria-label="Favorilerim">
              <span className="header-icon-wrap">
                <i className="far fa-heart" />
                {favoriteCount > 0 && <span className="cart-badge">{favoriteCount}</span>}
              </span>
              <span>Favorilerim</span>
            </Link>
            {customer && <NotificationBell />}
            {customer ? (
              <AccountMenu customer={customer} />
            ) : (
              <Link href="/giris" className="header-icon-labeled header-icon-mobile-hide" aria-label="Giriş Yap">
                <span className="header-icon-wrap">
                  <i className="far fa-user" />
                </span>
                <span>Giriş Yap</span>
              </Link>
            )}
            <Link href="/sepet" className="header-icon-labeled header-icon-mobile-hide" aria-label="Sepet">
              <span className="header-icon-wrap">
                <i className="fas fa-shopping-bag" />
                {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              </span>
              <span>Sepet</span>
            </Link>
          </div>
        </div>
      </header>

      {/* bkz. kullanıcı geri bildirimi: "mobilde arama yeri çalışmıyor" -
          bu div daha önce .header-inner'ın (sabit yükseklikli flex satırı)
          İÇİNDE bir flex öğesiydi, açılınca satırın dışına taşıp sayfayı
          yatayda kaydırıyordu. .main-header'ın altına, kendi doğal
          satırında ayrı bir blok olarak taşındı - artık taşma yok. */}
      {searchOpen && (
        <div className="mobile-search">
          <SearchBox categories={categories} autoFocus />
        </div>
      )}

      <nav className="main-nav">
        <div className="container">
          <ul className="nav-list">
            <li>
              <CategoryDropdown categories={categories} />
            </li>
            <li>
              <Link href="/urunler?sort=newest">Yeni Gelenler</Link>
            </li>
            <li>
              <Link href="/urunler?sort=popular">Çok Satanlar</Link>
            </li>
            <li>
              <Link href="/urunler?saleOnly=true" className="nav-sale">
                İndirimdekiler
              </Link>
            </li>
            <li>
              <Link href="/urunler">Markalar</Link>
            </li>
            <li>
              <Link href="/kampanyalar">Kampanyalar</Link>
            </li>
            <li>
              <Link href="/urunler?secondHand=true">Dolap</Link>
            </li>
            <li>
              <Link href="/magazalar">
                <i className="fas fa-store" /> Mağazalar
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </div>
  );
}
