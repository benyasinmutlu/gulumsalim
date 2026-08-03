import { meiliClient, PRODUCTS_INDEX } from "../../lib/meilisearch";

export interface SearchProductsParams {
  search?: string;
  categoryIds?: number[];
  vendorId?: number;
  size?: string;
  color?: string;
  brand?: string;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  saleOnly?: boolean;
  secondHand?: boolean;
  sort?: "price-asc" | "price-desc" | "newest" | "popular";
  page: number;
  limit: number;
}

// Bir arama isteğinin Meilisearch'e mi (metin arama/facet filtre/sıralama
// varsa) yoksa mevcut basit Postgres keyset sorgusuna mı (sade kategori/
// fiyat gözatma) gideceğine burada karar verilir - listProductsQuerySchema
// (bkz. catalog.schemas.ts) ile aynı alan isimlerini kullanır.
export function needsSearchIndex(params: Omit<SearchProductsParams, "page" | "limit">): boolean {
  return Boolean(
    params.search ||
      params.size ||
      params.color ||
      params.brand ||
      params.vendorId ||
      params.minRating ||
      params.sort ||
      params.secondHand,
  );
}

const SORT_MAP: Record<NonNullable<SearchProductsParams["sort"]>, string[]> = {
  "price-asc": ["basePrice:asc"],
  "price-desc": ["basePrice:desc"],
  newest: ["createdAt:desc"],
  popular: ["avgRating:desc"],
};

// bkz. kullanıcı isteği: "filtrelerde renk ve marka gibi şeyleri
// listelenenlere göre değişsin, listelende x markası varsa filtrede de x
// markası olsun" - sabit bir renk/marka listesi göstermek yerine, Meilisearch
// facetDistribution ile MEVCUT filtrelere (kategori/fiyat/beden/puan/mağaza/
// arama) göre GERÇEKTEN sonuç döndürecek renk/marka değerleri hesaplanır.
// Renk/marka'nın KENDİSİ bu filtreye dahil edilmez - aksi halde bir renk
// seçildiğinde diğer renkler facet'ten düşerdi (tek seçim aynı anda birini
// göstermesi gerekirken sıfırlanmış gibi görünürdü).
export async function getProductFacets(params: Omit<SearchProductsParams, "page" | "limit" | "color" | "brand" | "sort">) {
  const filters: string[] = ["visible = true"];
  if (params.categoryIds?.length) filters.push(`categoryId IN [${params.categoryIds.join(",")}]`);
  if (params.vendorId !== undefined) filters.push(`vendorId = ${params.vendorId}`);
  if (params.size) filters.push(`sizes = ${JSON.stringify(params.size)}`);
  if (params.minRating !== undefined) filters.push(`avgRating >= ${params.minRating}`);
  if (params.minPrice !== undefined) filters.push(`basePrice >= ${params.minPrice}`);
  if (params.maxPrice !== undefined) filters.push(`basePrice <= ${params.maxPrice}`);
  if (params.saleOnly) filters.push("onSale = true");
  if (params.secondHand) filters.push("isSecondHand = true");

  const result = await meiliClient.index(PRODUCTS_INDEX).search(params.search ?? "", {
    filter: filters.join(" AND "),
    facets: ["brand", "colors"],
    limit: 0,
  });

  const dist = result.facetDistribution ?? {};
  const brands = Object.keys(dist.brand ?? {}).sort((a, b) => a.localeCompare(b, "tr"));
  const colors = Object.keys(dist.colors ?? {}).sort((a, b) => a.localeCompare(b, "tr"));
  return { brands, colors };
}

export async function searchProducts(params: SearchProductsParams) {
  const filters: string[] = ["visible = true"];
  // bkz. catalog.repository.ts getCategoryIdWithDescendants - üst kategori
  // seçilince kendi id'si + alt kategorilerinin id'leri birlikte gelir,
  // Meilisearch'ün "IN" söz dizimiyle tek filtrede eşleştirilir.
  if (params.categoryIds?.length) filters.push(`categoryId IN [${params.categoryIds.join(",")}]`);
  if (params.vendorId !== undefined) filters.push(`vendorId = ${params.vendorId}`);
  if (params.size) filters.push(`sizes = ${JSON.stringify(params.size)}`);
  if (params.color) filters.push(`colors = ${JSON.stringify(params.color)}`);
  if (params.brand) filters.push(`brand = ${JSON.stringify(params.brand)}`);
  if (params.minRating !== undefined) filters.push(`avgRating >= ${params.minRating}`);
  if (params.minPrice !== undefined) filters.push(`basePrice >= ${params.minPrice}`);
  if (params.maxPrice !== undefined) filters.push(`basePrice <= ${params.maxPrice}`);
  if (params.saleOnly) filters.push("onSale = true");
  if (params.secondHand) filters.push("isSecondHand = true");

  const result = await meiliClient.index(PRODUCTS_INDEX).search(params.search ?? "", {
    filter: filters.join(" AND "),
    sort: params.sort ? SORT_MAP[params.sort] : undefined,
    offset: params.page * params.limit,
    limit: params.limit,
  });

  // Çağıran taraf (catalog.service.ts) için Postgres yolunun ürettiğiyle
  // BİREBİR AYNI şekle normalize edilir - Meilisearch dokümanındaki
  // sayısal createdAt/basePrice, API sözleşmesini (ProductListItem)
  // bozmasın diye burada string'e çevrilir.
  const items = (result.hits as MeiliProductDoc[]).map((doc) => ({
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    basePrice: doc.basePrice.toFixed(2),
    compareAtPrice: doc.compareAtPrice !== null ? doc.compareAtPrice.toFixed(2) : null,
    createdAt: new Date(doc.createdAt).toISOString(),
    vendorStoreName: doc.vendorName,
    vendorSlug: doc.vendorSlug,
    categorySlug: doc.categorySlug,
    primaryImageUrl: doc.primaryImageUrl,
    avgRating: doc.avgRating || null,
    reviewCount: doc.reviewCount,
    // bkz. olay: 2026-08-02 - bu ikisi (isSecondHand zaten var olan bir
    // alandı) daha önce bu normalize edilmiş şekle hiç kopyalanmıyordu,
    // yani filtrelenmiş/sıralanmış arama sonuçlarında "2. El" rozeti hiç
    // çıkmıyordu - fark edilip aynı anda düzeltildi. vendorIsIndividual
    // "Bireysel Satıcı" rozeti için (bkz. product-card.tsx).
    isSecondHand: doc.isSecondHand,
    vendorIsIndividual: doc.vendorIsIndividual,
  }));

  return {
    items,
    hasMore: result.estimatedTotalHits !== undefined && (params.page + 1) * params.limit < result.estimatedTotalHits,
  };
}

interface MeiliProductDoc {
  id: number;
  name: string;
  slug: string;
  basePrice: number;
  compareAtPrice: number | null;
  createdAt: number;
  vendorName: string;
  vendorSlug: string;
  categorySlug: string;
  primaryImageUrl: string | null;
  avgRating: number;
  reviewCount: number;
  isSecondHand: boolean;
  vendorIsIndividual: boolean;
}
