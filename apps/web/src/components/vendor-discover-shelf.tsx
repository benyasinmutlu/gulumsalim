import Link from "next/link";
import type { PublicVendorListItem, ProductListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";
import HscrollArrows from "@/components/hscroll-arrows";

// bkz. kullanıcı isteği: "mağazalar yeri keşfet sistemi şeklinde olsun
// mağazaların ürünleri listelensin mağazaya git şeklinde olsun mağazalardaki
// popüler ürünler gözüksün" - CategoryDealShelf ile aynı .deal-shelf görsel
// dili, başlık satırında bu sefer mağaza kimliği (logo + isim + puan) ve
// sağda ayrı bir "Mağazaya Git" bağlantısı var.
export default function VendorDiscoverShelf({
  vendor,
  products,
}: {
  vendor: PublicVendorListItem;
  products: ProductListItem[];
}) {
  const storeHref = `/${vendor.storeSlug}`;
  return (
    <div className="deal-shelf">
      <div className="deal-shelf-header">
        <Link href={storeHref} className="deal-shelf-title deal-shelf-vendor-title">
          <span className="deal-shelf-vendor-avatar">
            {vendor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo} alt={vendor.storeName} loading="lazy" decoding="async" />
            ) : (
              vendor.storeName.charAt(0)
            )}
          </span>
          <span>
            {vendor.storeName}
            {vendor.isVerified && <i className="fas fa-circle-check deal-shelf-vendor-verified" title="Doğrulanmış Mağaza" />}
          </span>
          {vendor.avgRating !== null && (
            <span className="deal-shelf-vendor-rating">
              <i className="fas fa-star" /> {Number(vendor.avgRating).toFixed(1)}
            </span>
          )}
        </Link>
        <Link href={storeHref} className="deal-shelf-vendor-cta">
          Mağazaya Git <i className="fas fa-arrow-right" />
        </Link>
      </div>
      <HscrollArrows>
        <div className="deal-shelf-products product-grid hscroll">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </HscrollArrows>
    </div>
  );
}
