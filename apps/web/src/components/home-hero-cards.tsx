import Link from "next/link";
import type { FeaturedCoupon } from "../lib/types";

function couponSummary(coupon: FeaturedCoupon): string {
  return coupon.type === "percent" ? `%${Number(coupon.value)} İndirim!` : `${Number(coupon.value).toFixed(0)} TL İndirim!`;
}

// Hero'nun sağındaki kartlar - bkz. kullanıcı isteği: mockup'taki gibi bu
// teşvikler hero'nun hemen yanında olsun. Mockup'ta bu üç kart "Süper
// İndirimler" / "İlk Alışverişine Özel İndirim" / "Satıcı Ol" - önceki
// halde ilk kart yerine kişiselleştirilmiş bir "Hoş Geldin" (hesap
// kısayolu) kartı vardı, mockup'la birebir eşleşmiyordu (hesap zaten
// header'da erişilebilir). "İlk Alışverişine Özel İndirim" kartı, admin'in
// isFeatured işaretlediği aktif bir kupon VARSA gösterilir (bkz.
// GET /coupons/featured) - sabit/uydurma bir kod asla gösterilmez.
export default function HomeHeroCards({ featuredCoupon }: { featuredCoupon: FeaturedCoupon | null }) {
  return (
    <div className="home-hero-cards">
      <div className="home-hero-card home-hero-card-sale">
        <i className="fas fa-bag-shopping home-hero-card-icon" />
        <h3>Süper İndirimler</h3>
        <p>%90&apos;a varan indirimler</p>
        <Link href="/urunler?saleOnly=true" className="btn btn-sm btn-primary">
          Keşfet <i className="fas fa-arrow-right" style={{ fontSize: 11 }} />
        </Link>
      </div>

      {featuredCoupon && (
        <div className="home-hero-card home-hero-card-coupon">
          <i className="fas fa-gift home-hero-card-icon" />
          <h3>İlk Alışverişine Özel {couponSummary(featuredCoupon)}</h3>
          <p>
            Kupon Kodu: <strong>{featuredCoupon.code}</strong>
            {featuredCoupon.minOrderAmount && ` (min. ${Number(featuredCoupon.minOrderAmount).toFixed(0)} TL sepet)`}
          </p>
          <Link href="/sepet" className="btn btn-sm btn-primary">
            Alışverişe Başla <i className="fas fa-arrow-right" style={{ fontSize: 11 }} />
          </Link>
        </div>
      )}

      <div className="home-hero-card home-hero-card-seller">
        <i className="fas fa-store home-hero-card-icon" />
        <h3>Kurumsal Üye Ol</h3>
        <p>Kendi mağazanı aç, binlerce müşteriyle buluş!</p>
        <Link href="/satici/kayit" className="btn btn-sm btn-secondary">
          Hemen Başvur <i className="fas fa-arrow-right" style={{ fontSize: 11 }} />
        </Link>
      </div>
    </div>
  );
}
