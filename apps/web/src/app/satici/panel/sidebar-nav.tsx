"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UnreadBadge from "./unread-badge";
import { useIsIndividualVendor } from "./vendor-type-context";

// vendor/boot.php'deki sidebar aktif-link vurgusunun karşılığı - önceki
// halde hiçbir Link'e koşullu class uygulanmıyordu.
export default function VendorSidebarNav() {
  const pathname = usePathname();
  const active = (href: string) => (pathname === href ? "active" : undefined);
  // bkz. kullanıcı isteği: "bireysel satıcıları ... yerleri daha basit ve
  // kullanımı kolay olsun" - toplu yükleme/koleksiyon/kampanya/mağaza
  // düzeni/raporlar tek tük ürün satan bireysel satıcı için gereksiz
  // karmaşıklık; işletme satıcılarda değişiklik yok. Route'lar hâlâ
  // çalışıyor, sadece menüden kaldırılıyor - büyümek isteyen bir bireysel
  // satıcı erişimini kaybetmiyor.
  const isIndividual = useIsIndividualVendor();

  return (
    <nav className="sidebar-nav">
      <Link href="/satici/panel" className={active("/satici/panel")}>
        <i className="fas fa-tachometer-alt nav-icon" /> Genel Bakış
      </Link>
      <Link href="/satici/panel/urunler" className={active("/satici/panel/urunler")}>
        <i className="fas fa-tshirt nav-icon" /> Ürünler
      </Link>
      <Link href="/satici/panel/urunler/yeni" className={active("/satici/panel/urunler/yeni")}>
        <i className="fas fa-plus-circle nav-icon" /> Ürün Ekle
      </Link>
      {!isIndividual && (
        <Link href="/satici/panel/toplu-yukleme" className={active("/satici/panel/toplu-yukleme")}>
          <i className="fas fa-file-csv nav-icon" /> Toplu Ürün Yükle
        </Link>
      )}
      {!isIndividual && (
        <Link href="/satici/panel/koleksiyonlar" className={active("/satici/panel/koleksiyonlar")}>
          <i className="fas fa-layer-group nav-icon" /> Koleksiyonlar
        </Link>
      )}
      {!isIndividual && (
        <Link href="/satici/panel/kanallar" className={active("/satici/panel/kanallar")}>
          <i className="fas fa-plug nav-icon" /> Kanallar
        </Link>
      )}
      {!isIndividual && (
        <Link href="/satici/panel/kampanyalar" className={active("/satici/panel/kampanyalar")}>
          <i className="fas fa-bullhorn nav-icon" /> Kampanyalar
        </Link>
      )}
      <Link href="/satici/panel/siparisler" className={active("/satici/panel/siparisler")}>
        <i className="fas fa-shopping-bag nav-icon" /> Siparişler
        <UnreadBadge kind="pendingOrders" />
      </Link>
      <Link href="/satici/panel/mesajlar" className={active("/satici/panel/mesajlar")}>
        <i className="fas fa-envelope nav-icon" /> Mesajlar
        <UnreadBadge kind="messages" />
      </Link>
      <Link href="/satici/panel/sorular" className={active("/satici/panel/sorular")}>
        <i className="fas fa-question-circle nav-icon" /> Sorular
      </Link>
      <Link href="/satici/panel/degerlendirmeler" className={active("/satici/panel/degerlendirmeler")}>
        <i className="fas fa-star nav-icon" /> Değerlendirmeler
      </Link>
      <Link href="/satici/panel/magaza" className={active("/satici/panel/magaza")}>
        <i className="fas fa-store nav-icon" /> Mağaza Profili
      </Link>
      {!isIndividual && (
        <Link href="/satici/panel/magaza-duzeni" className={active("/satici/panel/magaza-duzeni")}>
          <i className="fas fa-swatchbook nav-icon" /> Mağaza Düzeni
        </Link>
      )}
      <Link href="/satici/panel/finans" className={active("/satici/panel/finans")}>
        <i className="fas fa-wallet nav-icon" /> Finans
      </Link>
      {!isIndividual && (
        <Link href="/satici/panel/raporlar" className={active("/satici/panel/raporlar")}>
          <i className="fas fa-chart-bar nav-icon" /> Raporlar
        </Link>
      )}
      <Link href="/satici/panel/bildirimler" className={active("/satici/panel/bildirimler")}>
        <i className="fas fa-bell nav-icon" /> Bildirimler
        <UnreadBadge kind="notifications" />
      </Link>
      <Link href="/satici/panel/ayarlar" className={active("/satici/panel/ayarlar")}>
        <i className="fas fa-cog nav-icon" /> Ayarlar
      </Link>
    </nav>
  );
}
