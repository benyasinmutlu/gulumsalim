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
  searchParams: Promise<{ search?: string; category?: string }>;
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
  const { search, category } = await searchParams;
  const q = (search ?? "").trim();

  if (!q) {
    return (
      <main className="main-content">
        <div className="container-hero products-page">
          <span className="hero-tag products-page-eyebrow">Arama</span>
          <h1 className="products-page-title">Ne arıyorsunuz?</h1>
          <div className="empty-state">
            <i className="fas fa-magnifying-glass" aria-hidden />
            <p>Ürün, mağaza veya kategori aramak için yukarıdaki arama kutusunu kullanın.</p>
            {/* bkz. mobil denetim: "yukarıdaki arama kutusunu kullanın" metni
                mobilde yanıltıcı - header'da sabit bir kutu yok, sadece arama
                sayfasını açan bir büyüteç ikonu var. Bu sayfayı kendi
                başına yeterli kılan, JS gerektirmeyen (native GET form) bir
                arama kutusu - sadece mobilde görünür, masaüstü değişmiyor. */}
            <form action="/arama" method="GET" className="search-empty-form">
              <input type="search" name="search" placeholder="Ürün, mağaza veya kategori ara..." className="form-control" autoFocus />
              <button type="submit" className="btn btn-primary">
                <i className="fas fa-magnifying-glass" />
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  const matches = await getMatches(q);
  const hasMatches = matches.categories.length > 0 || matches.vendors.length > 0;

  return (
    <ProductListing
      params={{ search: q, category: category || undefined }}
      basePath="/arama"
      heading={`"${q}" için arama sonuçları`}
      beforeToolbar={
        hasMatches ? (
          <div className="search-matches">
            {matches.vendors.length > 0 && (
              <div className="search-match-group">
                <h3 className="search-match-group-title">Mağazalar ({matches.vendors.length})</h3>
                <div className="search-match-chips">
                  {matches.vendors.map((v) => (
                    <Link key={v.id} href={`/${v.storeSlug}`} className="search-match-vendor-chip">
                      <span className="search-match-vendor-avatar">
                        {v.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.logo} alt="" />
                        ) : (
                          <i className="fas fa-store" />
                        )}
                      </span>
                      <span>{v.storeName}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {matches.categories.length > 0 && (
              <div className="search-match-group">
                <h3 className="search-match-group-title">Kategoriler</h3>
                <div className="search-match-chips">
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
