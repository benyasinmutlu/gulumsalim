"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// gulumsalim.com'daki account.php sidebar sırasının birebir karşılığı:
// Siparişlerim, Profil Bilgilerim, Takip Ettiğim Mağazalar, Favorilerim,
// Değerlendirmelerim. Adreslerim/Sepetim eski sitede yoktu ama yeni adres
// defteri/sepet özellikleriyle tutarlı olsun diye sona eklendi.
const LINKS = [
  { href: "/hesabim/siparisler", label: "Siparişlerim", icon: "fa-box" },
  { href: "/hesabim", label: "Profil Bilgilerim", icon: "fa-user-edit" },
  { href: "/hesabim/magazalarim", label: "Takip Ettiğim Mağazalar", icon: "fa-store" },
  { href: "/hesabim/mesajlarim", label: "Mesajlarım", icon: "fa-envelope" },
  { href: "/hesabim/favoriler", label: "Favorilerim", icon: "fa-heart" },
  { href: "/hesabim/degerlendirmelerim", label: "Değerlendirmelerim", icon: "fa-star" },
  { href: "/hesabim/adresler", label: "Adreslerim", icon: "fa-map-marker-alt" },
  { href: "/sepet", label: "Sepetim", icon: "fa-shopping-bag" },
  // bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
  // kişilerde satış yapabilsin 2. el ürün letgo dolap gibi"
  { href: "/hesabim/satici-ol", label: "Ürünlerini Satışa Çıkar", icon: "fa-tags" },
];

export default function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="account-menu">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
          <i className={`fas ${link.icon}`} /> {link.label}
        </Link>
      ))}
    </nav>
  );
}
