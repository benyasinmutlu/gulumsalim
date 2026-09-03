import Link from "next/link";

// bkz. kullanıcı isteği (2026-08-02): trendyol.com anasayfasından ekran
// görüntüsü paylaşıldı - kategori şeridinin hemen altında renkli, yuvarlak
// ikonlu kısayol satırı vardı ("Bugün Fiyatı Düşenler", "Yeni Gelenler" vb.)
// Aynı YAPI uygulandı ama ÖZGÜN içerikle: her biri gerçekten var olan,
// çalışan bir sayfaya gidiyor (uydurma/placeholder link yok).
// bkz. kullanıcı isteği (2026-08-02): "Dolap 2. El başta olacak" - sıra
// değiştirildi, diğerleri aynı kaldı.
const LINKS: { label: string; href: string; icon: string; description: string }[] = [
  { label: "2. El", href: "/urunler?secondHand=true", icon: "fa-recycle", description: "Özenli ikinci el seçkisi" },
  { label: "Fiyatı Düşenler", href: "/urunler?saleOnly=true", icon: "fa-arrow-trend-down", description: "Gerçek indirimli ürünler" },
  { label: "Yeni Gelenler", href: "/urunler?sort=newest", icon: "fa-wand-magic-sparkles", description: "En yeni koleksiyonlar" },
  { label: "Trendler", href: "/urunler?sort=popular", icon: "fa-arrow-trend-up", description: "Şu an en çok ilgi görenler" },
  { label: "Kampanyalar", href: "/kampanyalar", icon: "fa-bullhorn", description: "Marka ve mağaza fırsatları" },
  { label: "Mağazalar", href: "/magazalar", icon: "fa-store", description: "Seçkin satıcıları keşfet" },
];

export default function QuickLinksRow() {
  return (
    <div className="quick-links-row">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="quick-link-item">
          <span className="quick-link-icon">
            <i className={`fas ${l.icon}`} />
          </span>
          <span className="quick-link-copy">
            <strong>{l.label}</strong>
            <small>{l.description}</small>
          </span>
          <i className="fas fa-arrow-right quick-link-arrow" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
