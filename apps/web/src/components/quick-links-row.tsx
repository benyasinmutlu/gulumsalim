import Link from "next/link";

// bkz. kullanıcı isteği (2026-08-02): trendyol.com anasayfasından ekran
// görüntüsü paylaşıldı - kategori şeridinin hemen altında renkli, yuvarlak
// ikonlu kısayol satırı vardı ("Bugün Fiyatı Düşenler", "Yeni Gelenler" vb.)
// Aynı YAPI uygulandı ama ÖZGÜN içerikle: her biri gerçekten var olan,
// çalışan bir sayfaya gidiyor (uydurma/placeholder link yok).
// bkz. kullanıcı isteği (2026-08-02): "Dolap 2. El başta olacak" - sıra
// değiştirildi, diğerleri aynı kaldı.
const LINKS: { label: string; href: string; icon: string; color: string }[] = [
  { label: "2. El", href: "/urunler?secondHand=true", icon: "fa-recycle", color: "#151515" },
  { label: "Fiyatı Düşenler", href: "/urunler?saleOnly=true", icon: "fa-arrow-trend-down", color: "#806A4F" },
  { label: "Yeni Gelenler", href: "/urunler?sort=newest", icon: "fa-wand-magic-sparkles", color: "#3F3F3B" },
  { label: "Çok Satanlar", href: "/urunler?sort=popular", icon: "fa-fire", color: "#6D5A43" },
  { label: "Kampanyalar", href: "/kampanyalar", icon: "fa-bullhorn", color: "#2F2F2D" },
  { label: "Mağazalar", href: "/magazalar", icon: "fa-store", color: "#5F5F5B" },
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
