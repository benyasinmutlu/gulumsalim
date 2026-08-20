import Link from "next/link";

// bkz. kullanıcı isteği (2026-08-02): trendyol.com anasayfasından ekran
// görüntüsü paylaşıldı - kategori şeridinin hemen altında renkli, yuvarlak
// ikonlu kısayol satırı vardı ("Bugün Fiyatı Düşenler", "Yeni Gelenler" vb.)
// Aynı YAPI uygulandı ama ÖZGÜN içerikle: her biri gerçekten var olan,
// çalışan bir sayfaya gidiyor (uydurma/placeholder link yok).
// bkz. kullanıcı isteği (2026-08-02): "Dolap 2. El başta olacak" - sıra
// değiştirildi, diğerleri aynı kaldı.
const LINKS: { label: string; href: string; icon: string; color: string }[] = [
  { label: "2. El", href: "/urunler?secondHand=true", icon: "fa-recycle", color: "#2196F3" },
  { label: "Fiyatı Düşenler", href: "/urunler?saleOnly=true", icon: "fa-arrow-trend-down", color: "#E91E63" },
  { label: "Yeni Gelenler", href: "/urunler?sort=newest", icon: "fa-sparkles", color: "#4CAF50" },
  { label: "Çok Satanlar", href: "/urunler?sort=popular", icon: "fa-fire", color: "#F5A623" },
  { label: "Kampanyalar", href: "/kampanyalar", icon: "fa-bullhorn", color: "#E53935" },
  { label: "Mağazalar", href: "/magazalar", icon: "fa-store", color: "#9C27B0" },
];

export default function QuickLinksRow() {
  return (
    <div className="quick-links-row">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="quick-link-item">
          <span className="quick-link-icon" style={{ background: l.color }}>
            <i className={`fas ${l.icon}`} />
          </span>
          <span>{l.label}</span>
        </Link>
      ))}
    </div>
  );
}
