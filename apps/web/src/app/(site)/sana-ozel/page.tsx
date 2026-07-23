import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";

interface DiscoverFeed {
  items: ProductListItem[];
  strategy: "personalized" | "cold_start" | "unavailable";
}

async function getDiscoverFeed(): Promise<DiscoverFeed> {
  try {
    return await apiFetchJson<DiscoverFeed>("/discover");
  } catch {
    return { items: [], strategy: "unavailable" };
  }
}

// Anasayfadaki "Senin İçin"/"Beğenebileceğin Ürünler" satırının "Tümünü
// Gör" hedefi - /urunler?sort=... gibi genel bir filtreye değil, kendi
// temiz URL'ine (gulumsalim.com'daki seo_slug mantığının karşılığı).
export default async function SanaOzelPage() {
  const feed = await getDiscoverFeed();
  const heading = feed.strategy === "personalized" ? "Senin İçin" : "Sana Özel Ürünler";

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">{heading}</span>
          </div>
        </div>
      </div>

      <div className="container products-page">
        <h1 className="products-page-title">{heading}</h1>
        <p className="section-subtitle" style={{ marginBottom: "1.5rem" }}>
          İlgi alanlarınıza ve trend olan ürünlere göre seçildi
        </p>

        {feed.items.length === 0 ? (
          <p className="empty-state">Şu an için önerebileceğimiz bir ürün yok, alışverişe devam ettikçe burası dolacak.</p>
        ) : (
          <div className="product-grid">
            {feed.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
