import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";

export const metadata: Metadata = { title: "Favorilerim | Gülüm Şalım" };

async function getFavorites(): Promise<ProductListItem[]> {
  try {
    return await apiFetchJson<ProductListItem[]>("/favorites");
  } catch {
    return [];
  }
}

export default async function CustomerFavoritesPage() {
  const favorites = await getFavorites();

  return (
    <>
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-heart" />
        </div>
        <div>
          <h3>Favorilerim</h3>
          <div className="account-page-subtitle">{favorites.length > 0 ? `${favorites.length} ürün` : "Beğendiğiniz ürünler"}</div>
        </div>
      </div>
      {favorites.length === 0 ? (
        <div className="form-card account-empty-state">
          <i className="fas fa-heart" />
          <p>Henüz favori ürününüz yok.</p>
          <Link href="/urunler" className="btn btn-primary btn-sm">
            Ürünlere Göz At
          </Link>
        </div>
      ) : (
        <div className="product-grid">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} initialFavorited />
          ))}
        </div>
      )}
    </>
  );
}
