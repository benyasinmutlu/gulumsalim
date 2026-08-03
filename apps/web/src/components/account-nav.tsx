"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// gulumsalim.com'daki account.php sidebar sırasının birebir karşılığı:
// Siparişlerim, Profil Bilgilerim, Takip Ettiğim Mağazalar, Favorilerim,
// Değerlendirmelerim. Adreslerim/Sepetim eski sitede yoktu ama yeni adres
// defteri/sepet özellikleriyle tutarlı olsun diye sona eklendi.
const BASE_LINKS = [
  { href: "/hesabim/siparisler", label: "Siparişlerim", icon: "fa-box" },
  { href: "/hesabim", label: "Profil Bilgilerim", icon: "fa-user-edit" },
  { href: "/hesabim/magazalarim", label: "Takip Ettiğim Mağazalar", icon: "fa-store" },
  { href: "/hesabim/mesajlarim", label: "Mesajlarım", icon: "fa-envelope" },
  { href: "/hesabim/favoriler", label: "Favorilerim", icon: "fa-heart" },
  { href: "/hesabim/degerlendirmelerim", label: "Değerlendirmelerim", icon: "fa-star" },
  { href: "/hesabim/adresler", label: "Adreslerim", icon: "fa-map-marker-alt" },
  { href: "/sepet", label: "Sepetim", icon: "fa-shopping-bag" },
];

export default function AccountNav({ hasStore }: { hasStore: boolean }) {
  const pathname = usePathname();

  // bkz. olay: 2026-08-01 "vergi nosu ve diğer bilgileri girdiğinde tekrar
  // tekrar ürünleri satışa çıkar demesin" - müşteri zaten bireysel satıcı
  // olduysa bu link artık "satışa çıkar" değil, doğrudan panele götürür.
  const lastLink = hasStore
    ? { href: "/satici/panel", label: "Satıcı Panelim", icon: "fa-store" }
    : { href: "/hesabim/satici-ol", label: "Ürünlerini Satışa Çıkar", icon: "fa-tags" };
  const links = [...BASE_LINKS, lastLink];

  return (
    <nav className="account-menu">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
          <i className={`fas ${link.icon}`} /> {link.label}
        </Link>
      ))}
    </nav>
  );
}
