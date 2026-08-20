import ProductListingGrid from "@/components/product-listing-grid";
import type { ProductListItem } from "@/lib/types";

// GEÇİCİ önizleme rotası (API'siz) - infinite-scroll ürün grid'ini görsel
// doğrulamak için mock verilerle. `(site)` grubunun DIŞINDA olduğu için
// API'ye bağımlı site layout'u çalışmaz. Screenshot sonrası silinir.
const NAMES = [
  "Çiçekli Yazlık Elbise",
  "Saten V-Yaka Gömlek",
  "Yüksek Bel Palazzo Pantolon",
  "Triko Hırka",
  "İpek Eşarp",
  "Deri Görünümlü Etek",
  "Oversize Blazer Ceket",
  "Dantel Detaylı Bluz",
];

function mock(i: number): ProductListItem {
  const price = 249.9 + i * 40;
  const onSale = i % 3 === 0;
  return {
    id: i + 1,
    name: NAMES[i % NAMES.length]!,
    slug: `urun-${i + 1}`,
    basePrice: price.toFixed(2),
    compareAtPrice: onSale ? (price * 1.4).toFixed(2) : null,
    createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
    vendorStoreName: ["Moda Butik", "Ela Concept", "Nar Çiçeği", "Beyaz Zambak"][i % 4]!,
    vendorSlug: "magaza",
    categorySlug: "elbise",
    primaryImageUrl: `https://picsum.photos/seed/gs${i + 1}/500/667`,
    imageUrls: [`https://picsum.photos/seed/gs${i + 1}/500/667`, `https://picsum.photos/seed/gsb${i + 1}/500/667`],
    avgRating: i % 2 === 0 ? 4.5 : null,
    reviewCount: i * 3,
    viewCount: 100 + i * 17,
    favoriteCount: 5 + i * 2,
    purchaseCount: i % 4 === 0 ? 12 + i : 0,
    cartCount: 0,
    isSecondHand: i === 5,
  };
}

const items = Array.from({ length: 8 }, (_, i) => mock(i));

export default function ListingPreview() {
  return (
    <main className="main-content">
      <div className="container products-page">
        <h1 className="products-page-title">Tüm Koleksiyon</h1>
        <ProductListingGrid initialItems={items} initialCursor="1" params={{}} />
      </div>
    </main>
  );
}
