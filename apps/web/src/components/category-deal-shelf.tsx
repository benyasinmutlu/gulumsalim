import Link from "next/link";
import type { Category, ProductListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";
import HscrollArrows from "@/components/hscroll-arrows";

// bkz. kullanıcı isteği (2026-08-02): önceki "1 ÜRÜNDE İNDİRİM" rozetli
// kategori fotoğraf kartları "çok kötü" bulundu, sonra denenen "solda
// fotoğraflı etiket + sağda ürünler" yan yana düzeni de yanlış anlaşılmıştı
// - asıl istenen: kategori BAŞLIĞI dikdörtgenin ÜSTÜNDE sol tarafta, ürünler
// ALTINDA yatay kaydırmalı bir şerit halinde (bkz. kullanıcı düzeltmesi:
// "kategori başlığı dikdörtgenin üstünde olsun ... sol üstte, altında
// ürünler olacak"). Şeridin SONUNDA ürün kartıyla aynı boyutta bir "Tümünü
// Gör" kartı var. `href` çağıran sayfaya göre değişir - /kampanyalar
// sayfası saleOnly ile filtreler, anasayfa önizlemesi filtresiz kategoriye
// gider (bkz. kullanıcı isteği: "tümünü gör diyince direkt kategoriye gitsin").
export default function CategoryDealShelf({
  category,
  products,
  href,
}: {
  category: Category;
  products: ProductListItem[];
  href?: string;
}) {
  const targetHref = href ?? `/${category.slug}`;
  return (
    <div className="deal-shelf">
      <Link href={targetHref} className="deal-shelf-title">
        {category.name}
      </Link>
      <HscrollArrows>
        <div className="deal-shelf-products product-grid hscroll">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
          <Link href={targetHref} className="deal-shelf-more-card">
            <span>Tümünü Gör</span>
            <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </HscrollArrows>
    </div>
  );
}
