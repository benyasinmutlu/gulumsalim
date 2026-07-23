import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { SearchMatches } from "@/lib/types";
import ProductListing from "@/components/product-listing";

async function getMatches(q: string): Promise<SearchMatches> {
  try {
    return await apiFetchJson<SearchMatches>(`/search-matches?q=${encodeURIComponent(q)}`);
  } catch {
    return { categories: [], vendors: [] };
  }
}

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { search } = await searchParams;
  const q = (search ?? "").trim();
  if (!q) return { title: "Arama | Gülüm Şalım" };
  return { title: `"${q}" Arama Sonuçları | Gülüm Şalım` };
}

// gulumsalim.com'daki search.php'nin karşılığı - arama kutusundan Enter'a
// basınca gelinen sayfa: ürün sonuçlarının üstünde eşleşen mağaza ve
// kategori özeti, altında da /urunler ile aynı filtre/sayfalama deneyimi.
export default async function SearchPage({ searchParams }: Props) {
  const { search } = await searchParams;
  const q = (search ?? "").trim();

  if (!q) {
    return (
      <main className="main-content">
        <div className="container products-page">
          <h1 className="products-page-title">Arama</h1>
          <p className="empty-state">Aramak için bir kelime girin.</p>
        </div>
      </main>
    );
  }

  const matches = await getMatches(q);
  const hasMatches = matches.categories.length > 0 || matches.vendors.length > 0;

  return (
    <ProductListing
      params={{ search: q }}
      basePath="/arama"
      heading={`"${q}" için arama sonuçları`}
      beforeToolbar={
        hasMatches ? (
          <div className="search-matches" style={{ marginBottom: 24 }}>
            {matches.vendors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Mağazalar ({matches.vendors.length})</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {matches.vendors.map((v) => (
                    <Link
                      key={v.id}
                      href={`/${v.storeSlug}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--color-border)", borderRadius: 20, padding: "6px 14px 6px 6px" }}
                    >
                      {v.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.logo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-bg-alt)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="fas fa-store" style={{ fontSize: 12 }} />
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{v.storeName}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {matches.categories.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Kategoriler</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {matches.categories.map((c) => (
                    <Link key={c.id} href={`/${c.slug}`} className="btn btn-secondary btn-sm">
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : undefined
      }
    />
  );
}
