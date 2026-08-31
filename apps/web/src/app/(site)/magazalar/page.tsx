import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { PublicVendorListItem, ProductListResponse, VendorStorefront } from "@/lib/types";
import StoresFilterBar from "./stores-filter-bar";
import VendorDiscoverShelf from "@/components/vendor-discover-shelf";

interface Props {
  searchParams: Promise<{ s?: string; sort?: string; verified?: string }>;
}

export const metadata: Metadata = {
  title: "Mağazalar | Gülüm Şalım",
  description: "Gülüm Şalım'daki tüm satıcı mağazalarını keşfedin, favori butiklerinizi takip edin.",
};

async function getVendors(): Promise<PublicVendorListItem[]> {
  try {
    return await apiFetchJson<PublicVendorListItem[]>("/vendors");
  } catch {
    return [];
  }
}

const SHELF_PRODUCT_LIMIT = 8;

// bkz. kullanıcı isteği: "mağazalardaki popüler ürünler gözüksün" - mevcut
// GET /products?vendor=&sort=popular ucu zaten var (Meilisearch tarafında
// puan bazlı sıralama, bkz. catalog.search.ts SORT_MAP), burada yeniden
// kullanılıyor - yeni bir backend ucu gerekmiyor.
async function getPopularProducts(storeSlug: string) {
  try {
    const res = await apiFetchJson<ProductListResponse>(
      `/products?vendor=${encodeURIComponent(storeSlug)}&sort=popular&limit=${SHELF_PRODUCT_LIMIT}`,
    );
    if (res.items.length > 0) return res.items;
  } catch {
    // Arama indeksi gecici olarak kullanilamazsa asagidaki DB-backed magazaya
    // ozel urun ucuna duseriz.
  }
  try {
    const storefront = await apiFetchJson<VendorStorefront>(
      `/vendors/${encodeURIComponent(storeSlug)}?limit=${SHELF_PRODUCT_LIMIT}`,
    );
    return storefront.products.items;
  } catch {
    return [];
  }
}

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
// bkz. kullanıcı isteği (2026-08-02): "mağazalar yeri keşfet sistemi
// şeklinde olsun mağazaların ürünleri listelensin mağazaya git şeklinde
// olsun mağazalardaki popüler ürünler gözüksün" - düz mağaza kartı ızgarası
// yerine, her mağaza için popüler ürünlerini gösteren bir raf (bkz.
// VendorDiscoverShelf, CategoryDealShelf ile aynı .deal-shelf görsel dili).
export default async function StoresPage({ searchParams }: Props) {
  const { s, sort = "newest", verified } = await searchParams;
  const allVendors = await getVendors();
  let vendors = s ? allVendors.filter((v) => v.storeName.toLocaleLowerCase("tr-TR").includes(s.toLocaleLowerCase("tr-TR"))) : allVendors;
  if (verified === "1") vendors = vendors.filter((v) => v.isVerified);
  vendors = sortVendors(vendors, sort).filter((v) => v.productCount > 0);

  const shelves = await Promise.all(
    vendors.map(async (v) => ({ vendor: v, products: await getPopularProducts(v.storeSlug) })),
  );
  const nonEmptyShelves = shelves.filter((shelf) => shelf.products.length > 0);

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
        <div className="stores-result-count">{nonEmptyShelves.length} mağaza bulundu</div>
        {nonEmptyShelves.length === 0 ? (
          <p className="empty-state">Bu aramaya uygun mağaza bulunamadı.</p>
        ) : (
          <div>
            {nonEmptyShelves.map(({ vendor, products }) => (
              <VendorDiscoverShelf key={vendor.id} vendor={vendor} products={products} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
