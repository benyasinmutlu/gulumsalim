import { meiliClient, PRODUCTS_INDEX } from "../../lib/meilisearch";

export interface SearchProductsParams {
  search?: string;
  categoryId?: number;
  vendorId?: number;
  size?: string;
  color?: string;
  brand?: string;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  saleOnly?: boolean;
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
    params.search || params.size || params.color || params.brand || params.vendorId || params.minRating || params.sort,
  );
}

const SORT_MAP: Record<NonNullable<SearchProductsParams["sort"]>, string[]> = {
  "price-asc": ["basePrice:asc"],
  "price-desc": ["basePrice:desc"],
  newest: ["createdAt:desc"],
  popular: ["avgRating:desc"],
};

export async function searchProducts(params: SearchProductsParams) {
  const filters: string[] = ["visible = true"];
  if (params.categoryId !== undefined) filters.push(`categoryId = ${params.categoryId}`);
  if (params.vendorId !== undefined) filters.push(`vendorId = ${params.vendorId}`);
  if (params.size) filters.push(`sizes = ${JSON.stringify(params.size)}`);
  if (params.color) filters.push(`colors = ${JSON.stringify(params.color)}`);
  if (params.brand) filters.push(`brand = ${JSON.stringify(params.brand)}`);
  if (params.minRating !== undefined) filters.push(`avgRating >= ${params.minRating}`);
  if (params.minPrice !== undefined) filters.push(`basePrice >= ${params.minPrice}`);
  if (params.maxPrice !== undefined) filters.push(`basePrice <= ${params.maxPrice}`);
  if (params.saleOnly) filters.push("onSale = true");

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
}
