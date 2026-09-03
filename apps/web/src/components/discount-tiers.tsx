import Link from "next/link";

// bkz. kullanıcı isteği (2026-08-02): trendyol.com'daki "İndirim Oranlarına
// Göre Avantajları Keşfet" kartlarının karşılığı - backend'de yeni eklenen
// minDiscountPercent filtresini kullanır (bkz. catalog.repository.ts),
// GERÇEK fiyat farkından hesaplanır (bkz. kullanıcı isteği: "kullanıcıların
// şikayet ettiklerini araştır" - araştırma şişirilmiş/sahte indirim
// yüzdesinin en yaygın pazaryeri şikayeti olduğunu gösterdi, bu yüzden
// burada gösterilen oranlar tamamen gerçek).
const TIERS: { percent: number; color: string }[] = [
  { percent: 10, color: "#F8F8F7" },
  { percent: 20, color: "#F2F2F0" },
  { percent: 30, color: "#EBEBE8" },
  { percent: 50, color: "#E3E2DE" },
];

export default function DiscountTiers() {
  return (
    <section className="discount-tiers-section">
      <div className="container">
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          İndirim Oranına Göre Keşfet
        </h2>
        <div className="discount-tiers-grid">
          {TIERS.map((t) => (
            <Link key={t.percent} href={`/urunler?minDiscountPercent=${t.percent}`} className="discount-tier-card" style={{ background: t.color }}>
              <span className="discount-tier-percent">%{t.percent}</span>
              <span className="discount-tier-label">ve üzeri indirim</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
