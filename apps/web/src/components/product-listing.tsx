import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { Category, ProductListResponse, PublicVendorListItem } from "@/lib/types";
import ProductCard from "@/components/product-card";
import ProductToolbar from "@/app/(site)/urunler/product-toolbar";
import { CategoryNavSync } from "@/components/category-nav-context";
import TitleBackgroundIcons from "@/components/title-background-icons";
import { categoryIcon } from "@/lib/title-icon";

export interface ProductListingParams {
  category?: string;
  cursor?: string;
  search?: string;
  saleOnly?: string;
  secondHand?: string;
  minDiscountPercent?: string;
  size?: string;
  fitToMe?: string;
  color?: string;
  brand?: string;
  vendor?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  // bkz. denetim raporu madde 11: "Ürün Durumu, Satıcı tipi, Ücretsiz kargo".
  condition?: string;
  freeShipping?: string;
  vendorType?: string;
}

async function getProducts(params: ProductListingParams): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  try {
    return await apiFetchJson<ProductListResponse>(`/products?${query.toString()}`);
  } catch {
    return { items: [], nextCursor: null };
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    return await apiFetchJson<Category[]>("/categories");
  } catch {
    return [];
  }
}

async function getVendors(): Promise<PublicVendorListItem[]> {
  try {
    return await apiFetchJson<PublicVendorListItem[]>("/vendors");
  } catch {
    return [];
  }
}

// bkz. denetim raporu madde 11: "Marka" filtresi - sabit bir liste değil,
// mevcut kategori/fiyat/vb. filtrelere göre GERÇEKTEN sonuç döndürecek
// marka/renk değerleri (bkz. catalog.search.ts getProductFacets).
async function getFacets(params: ProductListingParams): Promise<{ brands: string[]; colors: string[] }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "brand" && key !== "color" && key !== "sort" && key !== "cursor") query.set(key, value);
  }
  try {
    return await apiFetchJson<{ brands: string[]; colors: string[] }>(`/products/facets?${query.toString()}`);
  } catch {
    return { brands: [], colors: [] };
  }
}

interface Props {
  params: ProductListingParams;
  heading?: string;
  basePath?: string;
  lockedCategorySlug?: string;
  beforeToolbar?: React.ReactNode;
}

// gulumsalim.com'daki products.php'nin ürün listesi gövdesi - /urunler ve
// kategori/bölüm için temiz URL'ler kullanan sayfalar (/aksesuar,
// /sana-ozel gibi) arasında ortak. `basePath`, "sonraki sayfa" linkinin
// hangi temiz URL'e query ekleyerek devam edeceğini belirler.
export default async function ProductListing({
  params,
  heading: headingOverride,
  basePath = "/urunler",
  lockedCategorySlug,
  beforeToolbar,
}: Props) {
  const [{ items, nextCursor }, categories, vendors, facets] = await Promise.all([
    getProducts(params),
    getCategories(),
    getVendors(),
    getFacets(params),
  ]);

  const matchedCategory = params.category ? categories.find((c) => c.slug === params.category) : undefined;
  const heading =
    headingOverride ??
    (params.search
      ? `"${params.search}" için sonuçlar`
      : params.saleOnly
        ? "İndirimli Ürünler"
        : params.secondHand
          ? "2. El Ürünleri"
          : (matchedCategory?.name ?? "Tüm Koleksiyon"));

  // bkz. kullanıcı isteği: "tümünü gör sayfalarının arka planında başlığa
  // özel hareketli ikonlar olsun" - kategori sayfasındaysa o kategorinin
  // ikonu, indirim filtresindeyse etiket ikonu, aksi halde genel bir ikon.
  const headingIcon = matchedCategory
    ? categoryIcon(matchedCategory)
    : params.saleOnly
      ? "fa-tag"
      : params.secondHand
        ? "fa-recycle"
        : "fa-bag-shopping";

  const nextPageParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor") nextPageParams.set(key, value);
  }
  if (nextCursor) nextPageParams.set("cursor", nextCursor);

  // bkz. kullanıcı isteği: "Tümünü Gör dediğimde headerın kategorileri
  // gözükmeyecek sadece listelenen ürünlerden hangi kategoriler
  // listeniyorsa onlar olacak" - header menüsü bu sonuç kümesindeki
  // kategorilerle sınırlanır (bkz. category-nav-context.tsx).
  const resultCategorySlugs = new Set(items.map((p) => p.categorySlug));
  const resultCategories = categories.filter((c) => resultCategorySlugs.has(c.slug));

  return (
    <main className="main-content">
      <CategoryNavSync categories={resultCategories} />
      <TitleBackgroundIcons icon={headingIcon} />
      <div className="container products-page">
        <h1 className="products-page-title">{heading}</h1>

        {beforeToolbar}

        <ProductToolbar
          categories={categories}
          vendors={vendors}
          brands={facets.brands}
          colors={facets.colors}
          initial={params}
          basePath={basePath}
          lockedCategorySlug={lockedCategorySlug}
        />

        <div className="products-count">{items.length} adet ürün bulundu.</div>

        {items.length === 0 ? (
          <p className="empty-state">Bu filtrede ürün bulunamadı.</p>
        ) : (
          <div className="product-grid" id="productGrid">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {nextCursor && (
          <Link href={`${basePath}?${nextPageParams.toString()}`} className="btn btn-secondary">
            Sonraki sayfa
          </Link>
        )}
      </div>
    </main>
  );
}
