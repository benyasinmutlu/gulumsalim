import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { PublicVendorListItem } from "@/lib/types";

interface Props {
  searchParams: Promise<{ s?: string }>;
}

async function getVendors(): Promise<PublicVendorListItem[]> {
  try {
    return await apiFetchJson<PublicVendorListItem[]>("/vendors");
  } catch {
    return [];
  }
}

export default async function StoresPage({ searchParams }: Props) {
  const { s } = await searchParams;
  const allVendors = await getVendors();
  const vendors = s ? allVendors.filter((v) => v.storeName.toLocaleLowerCase("tr-TR").includes(s.toLocaleLowerCase("tr-TR"))) : allVendors;

  return (
    <main className="main-content">
      <div className="stores-hero">
        <h1>Mağazalar</h1>
        <p>Gülüm Şalım&apos;daki tüm satıcı mağazalarını keşfedin, favori markalarınızı takip edin.</p>
        <form className="stores-search" method="GET" action="/magazalar">
          <input type="text" name="s" defaultValue={s ?? ""} placeholder="Mağaza ara..." />
          <button type="submit" aria-label="Ara">
            <i className="fas fa-search" />
          </button>
        </form>
      </div>

      <div className="container">
        {vendors.length === 0 ? (
          <p className="empty-state">Bu aramaya uygun mağaza bulunamadı.</p>
        ) : (
          <div className="store-grid">
            {vendors.map((v) => (
              <Link key={v.id} href={`/${v.storeSlug}`} className="store-card">
                <div className="store-cover">
                  <div className="store-avatar">
                    {v.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.logo} alt={v.storeName} />
                    ) : (
                      v.storeName.charAt(0)
                    )}
                  </div>
                </div>
                <div className="store-body">
                  <div className="store-name">
                    {v.storeName}
                    {v.isVerified && <i className="fas fa-badge-check" style={{ color: "var(--color-primary)", marginLeft: 6 }} title="Doğrulanmış Mağaza" />}
                  </div>
                  <div className="store-meta">
                    <span>
                      <i className="fas fa-tshirt" /> {v.productCount} ürün
                    </span>
                    {v.avgRating !== null && (
                      <span>
                        <i className="fas fa-star" style={{ color: "#f5a623" }} /> {Number(v.avgRating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
