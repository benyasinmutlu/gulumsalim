import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { Category } from "@/lib/types";

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

export default async function Home() {
  const categories = await getCategories();

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

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/urunler" className="btn">
          Tüm ürünleri gör
        </Link>
      </p>
    </main>
  );
}
