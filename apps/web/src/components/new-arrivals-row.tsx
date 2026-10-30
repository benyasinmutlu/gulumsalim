import Link from "next/link";
import type { ProductListItem } from "../lib/types";
import ProductCard from "./product-card";
import HscrollArrows from "./hscroll-arrows";

export default function NewArrivalsRow({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  return (
    <section className="new-arrivals-section">
      <div className="container-hero">
        <div className="new-arrivals-header">
          <h2 className="section-title">Yeni Gelenler</h2>
          <Link href="/urunler?sort=newest" className="new-arrivals-cta">
            Tümünü Gör <i className="fas fa-arrow-right" />
          </Link>
        </div>
        <HscrollArrows>
          <div className="product-grid hscroll new-arrivals-grid shelf-landscape">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </HscrollArrows>
      </div>
    </section>
  );
}
