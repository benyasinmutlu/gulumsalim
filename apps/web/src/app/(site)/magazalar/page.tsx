import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { PublicVendorListItem } from "@/lib/types";
import StoresFilterBar from "./stores-filter-bar";

interface Props {
  searchParams: Promise<{ s?: string; sort?: string; verified?: string }>;
}

export const metadata: Metadata = { title: "Mağazalar | Gülüm Şalım" };

async function getVendors(): Promise<PublicVendorListItem[]> {
  try {
    return await apiFetchJson<PublicVendorListItem[]>("/vendors");
  } catch {
    return [];
  }
}

const SORT_OPTIONS = [
  { value: "newest", label: "Yeni Katılanlar" },
  { value: "rating", label: "En Yüksek Puan" },
  { value: "products", label: "En Çok Ürün" },
  { value: "followers", label: "En Çok Takipçi" },
  { value: "name", label: "İsme Göre (A-Z)" },
];

function sortVendors(vendors: PublicVendorListItem[], sort: string): PublicVendorListItem[] {
  const sorted = [...vendors];
  switch (sort) {
    case "rating":
      return sorted.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
    case "products":
      return sorted.sort((a, b) => b.productCount - a.productCount);
    case "followers":
      return sorted.sort((a, b) => b.followerCount - a.followerCount);
    case "name":
      return sorted.sort((a, b) => a.storeName.localeCompare(b.storeName, "tr"));
    default:
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

// bkz. kullanıcı isteği: "/magazalar burayı düzenle ve tasarımı iyileştir
// hataları ve eksiklikleri çöz tamamen" - eski halinde: kapak görseli
// hiç çekilip gösterilmiyordu (sadece logo), sıralama/filtre yoktu, takipçi
// sayısı hiç görünmüyordu, kaç mağaza bulunduğu belli değildi.
export default async function StoresPage({ searchParams }: Props) {
  const { s, sort = "newest", verified } = await searchParams;
  const allVendors = await getVendors();
  let vendors = s ? allVendors.filter((v) => v.storeName.toLocaleLowerCase("tr-TR").includes(s.toLocaleLowerCase("tr-TR"))) : allVendors;
  if (verified === "1") vendors = vendors.filter((v) => v.isVerified);
  vendors = sortVendors(vendors, sort);

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
        <StoresFilterBar s={s} sort={sort} verified={verified} />
      </div>

      <div className="container">
        <div className="stores-result-count">{vendors.length} mağaza bulundu</div>
        {vendors.length === 0 ? (
          <p className="empty-state">Bu aramaya uygun mağaza bulunamadı.</p>
        ) : (
          <div className="store-grid">
            {vendors.map((v) => (
              <Link key={v.id} href={`/${v.storeSlug}`} className="store-card">
                <div className="store-cover">
                  {v.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.coverImage} alt="" />
                  )}
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
                    <span>
                      <i className="fas fa-heart" /> {v.followerCount} takipçi
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
