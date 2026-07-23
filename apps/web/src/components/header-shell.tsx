"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category, CustomerProfile } from "../lib/types";
import SearchBox from "./search-box";

interface Props {
  categories: Category[];
  customer: CustomerProfile | null;
  cartCount: number;
  siteName?: string;
  siteLogo?: string;
}

// Header + kategori nav'ı birlikte "sticky" kalır, aşağı kaydırınca gizlenir,
// yukarı kaydırınca geri gelir - gulumsalim.com'daki #stickyHeaderWrap
// davranışının birebir karşılığı.
export default function HeaderShell({ categories, customer, cartCount, siteName, siteLogo }: Props) {
  const [hidden, setHidden] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setHidden(y > lastScrollY.current && y > 120);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`sticky-header-wrap${hidden ? " header-hidden" : ""}`}>
      <header className="main-header">
        <div className="container header-inner">
          <Link href="/" className="logo">
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt={siteName || "Gülüm Şalım"} className="logo-img" />
            ) : (
              <span className="logo-icon">🌸</span>
            )}
            <span className="logo-text">{siteName || "Gülüm Şalım"}</span>
          </Link>

          <div className="header-search">
            <SearchBox />
          </div>

          <div className="header-actions">
            <button
              className="header-icon search-toggle"
              aria-label="Ara"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <i className="fas fa-search" />
            </button>
            <Link href={customer ? "/hesabim" : "/giris"} className="header-icon" aria-label={customer ? "Hesabım" : "Giriş Yap"}>
              <i className={customer ? "fas fa-user" : "far fa-user"} />
            </Link>
            <Link href="/sepet" className="header-icon" aria-label="Sepet">
              <i className="fas fa-shopping-bag" />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
          </div>

          {searchOpen && (
            <div className="mobile-search">
              <SearchBox autoFocus />
            </div>
          )}
        </div>
      </header>

      <nav className="main-nav">
        <div className="container">
          <ul className="nav-list">
            <li>
              <Link href="/">Ana Sayfa</Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/kategori/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/urunler">Yeni Gelenler</Link>
            </li>
            <li>
              <Link href="/urunler?saleOnly=true" className="nav-sale">
                İndirimli
              </Link>
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
