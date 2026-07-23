import Link from "next/link";
import { productUrl, type ProductListItem } from "../lib/types";
import QuickAddButton from "./quick-add-button";
import FavoriteButton from "./favorite-button";

const NEW_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000;

// gulumsalim.com'daki renderProductCardHTML()'in birebir karşılığı: rozet
// sırası her zaman İNDİRİM yüzdesi + YENİ, "Çok Satan"/"Ücretsiz Kargo" gibi
// eski sitede olmayan rozetler kasıtlı olarak yok.
export default function ProductCard({
  product,
  initialFavorited,
}: {
  product: ProductListItem;
  initialFavorited?: boolean;
}) {
  const discountPercent = product.compareAtPrice
    ? Math.round((1 - Number(product.basePrice) / Number(product.compareAtPrice)) * 100)
    : null;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < NEW_THRESHOLD_MS;
  const detailHref = productUrl(product);

  return (
    <div className="product-card">
      <div className="product-image">
        <Link href={detailHref}>
          {product.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="product-img-current" src={product.primaryImageUrl} alt={product.name} />
          ) : (
            product.name.charAt(0)
          )}
        </Link>
        <div className="product-badges">
          {discountPercent !== null && discountPercent > 0 && <span className="badge badge-sale">%{discountPercent} İNDİRİM</span>}
          {isNew && <span className="badge badge-new">YENİ</span>}
        </div>
        <FavoriteButton productId={product.id} initialFavorited={initialFavorited} />
        <div className="product-actions-overlay">
          <QuickAddButton productId={product.id} productSlug={product.slug} productHref={detailHref} />
          <Link href={detailHref} className="product-action-btn" title="Detay">
            <i className="fas fa-eye" />
          </Link>
        </div>
      </div>
      <div className="product-info">
        <div className="product-category">
          <span>{product.vendorStoreName}</span>
        </div>
        <h3 className="product-name">
          <Link href={detailHref}>{product.name}</Link>
        </h3>
        <div className="product-price">
          <span className="price-current">
            {Number(product.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
          </span>
          {product.compareAtPrice && (
            <span className="price-old">
              {Number(product.compareAtPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
