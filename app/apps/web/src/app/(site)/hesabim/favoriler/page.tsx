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
    <div className="form-card">
      <h3>Favorilerim</h3>
      {favorites.length === 0 ? (
        <p style={{ fontSize: "0.9rem" }}>Henüz favori ürününüz yok.</p>
      ) : (
        <div className="product-grid">
          {favorites.map((product) => (
            <ProductCard key={product.id} product={product} initialFavorited />
          ))}
        </div>
      )}
    </div>
  );
}
