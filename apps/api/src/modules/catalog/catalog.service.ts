import { decodeCursor, encodeCursor } from "../../lib/pagination";
import { findActiveVendorBySlugPublic } from "../vendors/vendor.repository";
import { needsSearchIndex, searchProducts } from "./catalog.search";
import {
  fetchSocialProofByIds,
  findCategoryBySlug,
  findProductBySlug,
  listActiveCategories,
  listActiveProducts,
} from "./catalog.repository";
import type { ListProductsQuery } from "./catalog.schemas";

export async function getCategories() {
  return listActiveCategories();
}

export async function getProducts(query: ListProductsQuery) {
  let categoryId: number | undefined;
  if (query.category) {
    const category = await findCategoryBySlug(query.category);
    if (!category) return { items: [], nextCursor: null };
    categoryId = category.id;
  }

  let vendorId: number | undefined;
  if (query.vendor) {
    const vendor = await findActiveVendorBySlugPublic(query.vendor);
    if (!vendor) return { items: [], nextCursor: null };
    vendorId = vendor.id;
  }

  const filterParams = {
    search: query.search,
    categoryId,
    vendorId,
    size: query.size,
    color: query.color,
    brand: query.brand,
    minRating: query.minRating,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    saleOnly: query.saleOnly,
    sort: query.sort,
  };

  // Metin arama ya da herhangi bir facet filtresi/sıralama varsa
  // Meilisearch'e gidilir (gerçek tam metin arama + filtreleme);
  // sade kategori/fiyat gözatma mevcut Postgres keyset sorgusunda kalır
  // (1M+ üründe OFFSET'ten daha ölçeklenebilir).
  if (needsSearchIndex(filterParams)) {
    const page = query.cursor ? Number(query.cursor) : 0;
    const { items, hasMore } = await searchProducts({ ...filterParams, page, limit: query.limit });
    // Meilisearch dokümanı favori/satış/görüntülenme sayaçlarını taşımaz
    // (bkz. catalog.repository.ts fetchSocialProofByIds yorumu) - burada
    // Postgres'ten canlı eklenir, Postgres yolunun (listActiveProducts)
    // ürettiğiyle aynı alanlar tamamlanmış olur.
    const counts = await fetchSocialProofByIds(items.map((i) => i.id));
    const enriched = items.map((item) => ({
      ...item,
      viewCount: counts.get(item.id)?.viewCount ?? 0,
      favoriteCount: counts.get(item.id)?.favoriteCount ?? 0,
      purchaseCount: counts.get(item.id)?.purchaseCount ?? 0,
    }));
    return { items: enriched, nextCursor: hasMore ? String(page + 1) : null };
  }

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const rows = await listActiveProducts({
    categoryId,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    saleOnly: query.saleOnly,
    cursor,
    limit: query.limit,
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return { items, nextCursor };
}

export async function getProductBySlug(slug: string) {
  return findProductBySlug(slug);
}
