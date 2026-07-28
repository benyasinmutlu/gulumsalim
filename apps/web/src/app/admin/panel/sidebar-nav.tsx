"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminUnreadBadge from "./unread-badge";

// boot.php'deki sb-link.on (aktif sayfa vurgusu) davranışının karşılığı -
// önceki halde hiçbir Link'e koşullu class uygulanmıyordu, bu yüzden
// admin hangi sayfada olduğunu sidebar'dan hiç göremiyordu.
export default function AdminSidebarNav() {
  const pathname = usePathname();
  const cls = (href: string) => `sidebar-link${pathname === href ? " active" : ""}`;

  return (
    <nav className="sidebar-nav">
      <div className="sidebar-section">
        <div className="sidebar-section-title">Ana Menü</div>
        <Link href="/admin/panel" className={cls("/admin/panel")}>
          <i className="fas fa-tachometer-alt" />
          <span>Gösterge Paneli</span>
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Katalog</div>
        <Link href="/admin/panel/urunler" className={cls("/admin/panel/urunler")}>
          <i className="fas fa-tshirt" />
          <span>Ürünler</span>
        </Link>
        <Link href="/admin/panel/kategoriler" className={cls("/admin/panel/kategoriler")}>
          <i className="fas fa-tags" />
          <span>Kategoriler</span>
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Satış</div>
        <Link href="/admin/panel/siparisler" className={cls("/admin/panel/siparisler")}>
          <i className="fas fa-shopping-bag" />
          <span>Siparişler</span>
          <AdminUnreadBadge kind="pendingOrders" />
        </Link>
        <Link href="/admin/panel/iadeler" className={cls("/admin/panel/iadeler")}>
          <i className="fas fa-undo" />
          <span>İadeler</span>
        </Link>
        <Link href="/admin/panel/musteriler" className={cls("/admin/panel/musteriler")}>
          <i className="fas fa-users" />
          <span>Müşteriler</span>
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Satıcılar</div>
        <Link href="/admin/panel/saticilar" className={cls("/admin/panel/saticilar")}>
          <i className="fas fa-store" />
          <span>Satıcı Yönetimi</span>
          <AdminUnreadBadge kind="pendingVendors" />
        </Link>
        <Link href="/admin/panel/odemeler" className={cls("/admin/panel/odemeler")}>
          <i className="fas fa-wallet" />
          <span>Ödemeler</span>
          <AdminUnreadBadge kind="pendingPayouts" />
        </Link>
        <Link href="/admin/panel/satici-mesajlari" className={cls("/admin/panel/satici-mesajlari")}>
          <i className="fas fa-comments" />
          <span>Satıcı Mesajları</span>
          <AdminUnreadBadge kind="unreadVendorMessages" />
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Moderasyon</div>
        <Link href="/admin/panel/degerlendirmeler" className={cls("/admin/panel/degerlendirmeler")}>
          <i className="fas fa-star" />
          <span>Değerlendirmeler</span>
          <AdminUnreadBadge kind="pendingReviews" />
        </Link>
        <Link href="/admin/panel/iletisim-mesajlari" className={cls("/admin/panel/iletisim-mesajlari")}>
          <i className="fas fa-envelope" />
          <span>İletişim Mesajları</span>
          <AdminUnreadBadge kind="unreadContactMessages" />
        </Link>
        <Link href="/admin/panel/site-geri-bildirimleri" className={cls("/admin/panel/site-geri-bildirimleri")}>
          <i className="fas fa-comment-dots" />
          <span>Site Geri Bildirimleri</span>
          <AdminUnreadBadge kind="unreadSiteFeedback" />
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">İçerik</div>
        <Link href="/admin/panel/anasayfa-bolumleri" className={cls("/admin/panel/anasayfa-bolumleri")}>
          <i className="fas fa-th-large" />
          <span>Anasayfa Bölümleri</span>
        </Link>
        <Link href="/admin/panel/anasayfa-koleksiyonlari" className={cls("/admin/panel/anasayfa-koleksiyonlari")}>
          <i className="fas fa-layer-group" />
          <span>Anasayfa Koleksiyonları</span>
        </Link>
        <Link href="/admin/panel/sayfalar" className={cls("/admin/panel/sayfalar")}>
          <i className="fas fa-file-alt" />
          <span>Sayfalar</span>
        </Link>
        <Link href="/admin/panel/slider" className={cls("/admin/panel/slider")}>
          <i className="fas fa-images" />
          <span>Slider</span>
        </Link>
        <Link href="/admin/panel/banner" className={cls("/admin/panel/banner")}>
          <i className="fas fa-bullhorn" />
          <span>Banner</span>
          <AdminUnreadBadge kind="pendingBanners" />
        </Link>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Sistem</div>
        <Link href="/admin/panel/ayarlar" className={cls("/admin/panel/ayarlar")}>
          <i className="fas fa-cog" />
          <span>Ayarlar</span>
        </Link>
        <Link href="/" target="_blank" className="sidebar-link">
          <i className="fas fa-external-link-alt" />
          <span>Mağazayı Görüntüle</span>
        </Link>
      </div>
    </nav>
  );
}
