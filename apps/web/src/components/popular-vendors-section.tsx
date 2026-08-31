import Link from "next/link";
import type { PublicVendorListItem } from "../lib/types";

// bkz. kullanıcı isteği (mockup): "Popüler Mağazalar" bölümü - önceki
// denetimde anasayfada hiç olmadığı tespit edilmişti. /vendors zaten
// productCount/followerCount/avgRating döndürüyor, yeni bir backend
// gerekmedi - sadece en popüler (takipçiye göre) mağazaları dairesel
// avatar şeridinde gösteren yeni bir bileşen.
export default function PopularVendorsSection({ vendors }: { vendors: PublicVendorListItem[] }) {
  // bkz. denetim raporu madde 2: "0 ürünlü mağazalar ana sayfada
  // gösterilmesin" - /magazalar sayfasında zaten uygulanan
  // productCount > 0 filtresi buraya da taşındı.
  const popular = vendors
    .filter((v) => v.productCount > 0)
    .sort((a, b) => b.followerCount - a.followerCount)
    .slice(0, 10);
  if (popular.length === 0) return null;

  return (
    <section className="popular-vendors-section">
      <div className="container">
        <div className="section-header section-header-flex">
          <h2 className="section-title">Popüler Mağazalar</h2>
          <Link href="/magazalar" className="section-cta">
            Tümünü Gör
          </Link>
        </div>
        <div className="popular-vendors-row hscroll">
          {popular.map((v) => (
            <Link key={v.id} href={`/${v.storeSlug}`} className="popular-vendor-card">
              <div className="popular-vendor-avatar">
                {v.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.logo} alt={v.storeName} loading="lazy" decoding="async" />
                ) : (
                  v.storeName.charAt(0)
                )}
              </div>
              <span className="popular-vendor-name">{v.storeName}</span>
              {v.avgRating !== null && (
                <span className="popular-vendor-rating">
                  <i className="fas fa-star" /> {v.avgRating.toFixed(1)}
                </span>
              )}
              <span className="popular-vendor-count">{v.productCount} Ürün</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
