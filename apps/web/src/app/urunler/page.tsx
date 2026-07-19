import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { ProductListResponse } from "@/lib/types";

interface Props {
  searchParams: Promise<{ category?: string; cursor?: string }>;
}

async function getProducts(category?: string, cursor?: string): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  try {
    return await apiFetchJson<ProductListResponse>(`/products?${params.toString()}`);
  } catch {
    return { items: [], nextCursor: null };
  }
}

export default async function ProductsPage({ searchParams }: Props) {
  const { category, cursor } = await searchParams;
  const { items, nextCursor } = await getProducts(category, cursor);

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem" }}>{category ? `Kategori: ${category}` : "Tüm Ürünler"}</h1>

      {items.length === 0 ? (
        <p className="empty-state">Bu filtrede ürün bulunamadı.</p>
      ) : (
        <div className="product-grid">
          {items.map((p) => (
            <Link key={`${p.id}`} href={`/urun/${p.slug}`} className="product-card">
              <span>{p.name}</span>
              <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>{p.vendorStoreName}</span>
              <span className="price">
                {Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                {p.compareAtPrice && (
                  <span className="price-old">
                    {Number(p.compareAtPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}

      {nextCursor && (
        <Link
          href={`/urunler?${new URLSearchParams({ ...(category ? { category } : {}), cursor: nextCursor }).toString()}`}
          className="btn btn-secondary"
        >
          Sonraki sayfa
        </Link>
      )}
    </main>
  );
}
