"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CustomerProfile } from "../lib/types";

// Header'daki tek "hesap" ikonunun yerine geçen avatar+dropdown - bkz.
// kullanıcı isteği: mockup'taki gibi giriş yapmış müşteri için Hesabım/
// Siparişlerim/Çıkış Yap kısayolları tek tıkla erişilebilir olsun.
export default function AccountMenu({ customer }: { customer: CustomerProfile }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initial = customer.fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="header-account-wrap header-icon-mobile-hide" ref={wrapRef}>
      <button
        type="button"
        className="header-account-btn"
        aria-label="Hesap Menüsü"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="header-account-avatar">
          {customer.avatarUrl ? <img src={customer.avatarUrl} alt="" /> : initial}
        </span>
        <span className="header-account-btn-label">
          Hesabım <i className="fas fa-chevron-down" />
        </span>
      </button>

      {open && (
        <div className="header-account-panel">
          <div className="header-account-name">{customer.fullName}</div>
          <Link href="/hesabim" onClick={() => setOpen(false)}>
            <i className="fas fa-user" /> Hesabım
          </Link>
          <Link href="/hesabim/siparisler" onClick={() => setOpen(false)}>
            <i className="fas fa-box" /> Siparişlerim
          </Link>
          <Link href="/hesabim/favoriler" onClick={() => setOpen(false)}>
            <i className="fas fa-heart" /> Favorilerim
          </Link>
          <a href="/api/auth/logout" className="header-account-logout">
            <i className="fas fa-sign-out-alt" /> Çıkış Yap
          </a>
        </div>
      )}
    </div>
  );
}
