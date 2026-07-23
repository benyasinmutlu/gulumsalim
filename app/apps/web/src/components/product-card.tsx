import Link from "next/link";
import { productUrl, type ProductListItem } from "../lib/types";
import QuickAddButton from "./quick-add-button";
import FavoriteButton from "./favorite-button";
import ProductCardImage from "./product-card-image";

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
  const images = product.imageUrls?.length ? product.imageUrls : product.primaryImageUrl ? [product.primaryImageUrl] : [];

  return (
    <div className="product-card">
      <div className="product-image">
        {images.length > 0 ? (
          <ProductCardImage href={detailHref} images={images} alt={product.name} />
        ) : (
          <Link href={detailHref} className="product-image-fallback">
            {product.name.charAt(0)}
          </Link>
        )}
        <div className="product-badges">
          {discountPercent !== null && discountPercent > 0 && <span className="badge badge-sale">%{discountPercent} İNDİRİM</span>}
          {isNew && <span className="badge badge-new">YENİ</span>}
          {product.isSecondHand && <span className="badge badge-secondhand">2. EL</span>}
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
        {/* bkz. kullanıcı isteği: "YAYINLANAN HİÇ BİR ÜRÜNDE KAÇ KERE
            SEPETE EKLENDİĞİ KAÇ KERE FAVORİLENDİĞİ KAÇ KERE BAKILDIĞINI
            GÖSTERME" - görüntülenme/favori/sepet sayaçları kaldırıldı,
            sadece satın alma sayısı (varsa) gösterilmeye devam eder. */}
        {product.purchaseCount > 0 && (
          <div className="product-social-proof">
            <span title={`${product.purchaseCount} kişi satın aldı`}>
              <i className="fas fa-shopping-bag" /> {product.purchaseCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
