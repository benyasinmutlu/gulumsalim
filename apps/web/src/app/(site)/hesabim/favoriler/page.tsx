import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";
import AccountPageHeader from "@/components/account-page-header";

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
      <AccountPageHeader
        icon="fa-heart"
        title="Favorilerim"
        subtitle={favorites.length > 0 ? `${favorites.length} ürün` : "Beğendiğiniz ürünler"}
      />
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
