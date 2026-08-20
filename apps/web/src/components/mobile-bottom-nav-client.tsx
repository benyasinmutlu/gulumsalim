"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category } from "../lib/types";

interface Props {
  categories: Category[];
  cartCount: number;
  favoriteCount: number;
  loggedIn: boolean;
}

export default function MobileBottomNavClient({ categories, cartCount, favoriteCount, loggedIn }: Props) {
  const pathname = usePathname();
  const [catOpen, setCatOpen] = useState(false);
  const topLevel = categories.filter((c) => !c.parentId);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {catOpen && <div className="mbn-overlay" onClick={() => setCatOpen(false)} />}

      {catOpen && (
        <div className="mbn-cat-sheet">
          <div className="mbn-cat-sheet-head">
            <h4>Kategoriler</h4>
            <button type="button" aria-label="Kapat" onClick={() => setCatOpen(false)}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="mbn-cat-sheet-list">
            {topLevel.map((c) => (
              <Link key={c.id} href={`/${c.slug}`} onClick={() => setCatOpen(false)}>
                <i className={c.icon || "fas fa-tag"} />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        <Link href="/" className={`mbn-item${isActive("/") ? " is-active" : ""}`}>
          <i className="fas fa-home" />
          <span>Ana Sayfa</span>
        </Link>
        <button type="button" className={`mbn-item${catOpen ? " is-active" : ""}`} onClick={() => setCatOpen((v) => !v)}>
          <i className="fas fa-bars" />
          <span>Kategoriler</span>
        </button>
        <Link href="/sepet" className={`mbn-item${isActive("/sepet") ? " is-active" : ""}`}>
          <span className="mbn-icon-wrap">
            <i className="fas fa-shopping-bag" />
            {cartCount > 0 && <span className="mbn-badge">{cartCount}</span>}
          </span>
          <span>Sepetim</span>
        </Link>
        <Link href="/hesabim/favoriler" className={`mbn-item${isActive("/hesabim/favoriler") ? " is-active" : ""}`}>
          <span className="mbn-icon-wrap">
            <i className="far fa-heart" />
            {favoriteCount > 0 && <span className="mbn-badge">{favoriteCount}</span>}
          </span>
          <span>Favorilerim</span>
        </Link>
        <Link
          href={loggedIn ? "/hesabim" : "/giris"}
          className={`mbn-item${isActive("/hesabim") || isActive("/giris") ? " is-active" : ""}`}
        >
          <i className="far fa-user" />
          <span>Hesabım</span>
        </Link>
      </nav>
    </>
  );
}
