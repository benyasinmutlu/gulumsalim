import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { Category, ProductListItem } from "@/lib/types";

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

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

export default async function Home() {
  const [categories, discover] = await Promise.all([getCategories(), getDiscoverFeed()]);

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1>Gülüm Şalım</h1>
      <p style={{ opacity: 0.75, marginTop: "0.4rem" }}>Kadın Giyim — Şıklığınızı Tamamlayın</p>

      <h2 style={{ marginTop: "2rem", fontSize: "1.1rem" }}>Kategoriler</h2>
      {categories.length === 0 ? (
        <p className="empty-state">Kategoriler yüklenemedi.</p>
      ) : (
        <div className="product-grid">
          {categories.map((c) => (
            <Link key={c.id} href={`/urunler?category=${c.slug}`} className="product-card">
              <strong>{c.name}</strong>
            </Link>
          ))}
        </div>
      )}

      {discover.items.length > 0 && (
        <>
          <h2 style={{ marginTop: "2.5rem", fontSize: "1.1rem" }}>
            {discover.strategy === "personalized" ? "Senin İçin" : "Keşfet"}
          </h2>
          <div className="product-grid">
            {discover.items.map((p) => (
              <Link key={p.id} href={`/urun/${p.slug}`} className="product-card">
                <span>{p.name}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>{p.vendorStoreName}</span>
                <span className="price">
                  {Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/urunler" className="btn">
          Tüm ürünleri gör
        </Link>
      </p>
    </main>
  );
}
