import { decodeCursor, encodeCursor } from "../../lib/pagination";
import { findActiveVendorBySlugPublic } from "../vendors/vendor.repository";
import { getProductFacets as getProductFacetsFromIndex, needsSearchIndex, searchProducts } from "./catalog.search";
import {
  fetchSocialProofByIds,
  findCategoryBySlug,
  findProductBySlug,
  getCategoryIdWithDescendants,
  listActiveCategories,
  listActiveProducts,
} from "./catalog.repository";
import type { ListProductsQuery } from "./catalog.schemas";
import { sizeNeighbors } from "../product-intelligence/normalize/size";
import type { SizePrefs } from "../../db/schema/customers";

// Müşterinin beden tercihlerini "bir alt + asıl + bir üst" komşularıyla
// birlikte tek, tekil bir beden listesine açar (Meilisearch inStockSizes IN).
function expandSizePrefs(prefs: SizePrefs): string[] {
  const out = new Set<string>();
  for (const s of prefs.kadinBeden ?? []) for (const n of sizeNeighbors(s, "kadinBeden")) out.add(n);
  for (const s of prefs.ayakkabiNo ?? []) for (const n of sizeNeighbors(String(s), "ayakkabiNo")) out.add(n);
  for (const s of prefs.cocukBeden ?? []) for (const n of sizeNeighbors(s, "cocukBeden")) out.add(n);
  return [...out];
}

export async function getCategories() {
  return listActiveCategories();
}

export async function getProducts(query: ListProductsQuery, sizePrefs?: SizePrefs | null) {
  let categoryIds: number[] | undefined;
  if (query.category) {
    const category = await findCategoryBySlug(query.category);
    if (!category) return { items: [], nextCursor: null };
    // Üst kategori (ör. "Giyim") ziyaret edilince alt kategorilerinin
    // ürünleri de gelsin diye (bkz. getCategoryIdWithDescendants yorumu).
    categoryIds = await getCategoryIdWithDescendants(category.id);
  }

  let vendorId: number | undefined;
  if (query.vendor) {
    const vendor = await findActiveVendorBySlugPublic(query.vendor);
    if (!vendor) return { items: [], nextCursor: null };
    vendorId = vendor.id;
  }

  // "Bedenime uygun": profildeki bedenler + komşuları (stok-farkında filtre).
  // Bayrak kapalıysa ya da beden yoksa undefined → normal gözatma bozulmaz.
  const fitSizes = query.fitToMe && sizePrefs ? expandSizePrefs(sizePrefs) : undefined;

  const filterParams = {
    search: query.search,
    categoryIds,
    vendorId,
    size: query.size,
    sizes: fitSizes && fitSizes.length > 0 ? fitSizes : undefined,
    color: query.color,
    brand: query.brand,
    minRating: query.minRating,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    saleOnly: query.saleOnly,
    secondHand: query.secondHand,
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
    categoryIds,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    saleOnly: query.saleOnly,
    minDiscountPercent: query.minDiscountPercent,
    secondHand: query.secondHand,
    cursor,
    limit: query.limit,
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return { items, nextCursor };
}

// bkz. kullanıcı isteği: "filtrelerde renk ve marka gibi şeyleri
// listelenenlere göre değişsin" - /urunler sayfasındaki filtre kenar
// çubuğu artık sabit bir renk/marka listesi değil, bu uçtan aldığı GERÇEK
// (mevcut kategori/fiyat/beden/puan/mağaza/arama filtrelerine göre sonuç
// döndürecek) değerleri gösterir.
export async function getProductFacets(query: ListProductsQuery) {
  let categoryIds: number[] | undefined;
  if (query.category) {
    const category = await findCategoryBySlug(query.category);
    if (!category) return { brands: [], colors: [] };
    categoryIds = await getCategoryIdWithDescendants(category.id);
  }

  let vendorId: number | undefined;
  if (query.vendor) {
    const vendor = await findActiveVendorBySlugPublic(query.vendor);
    if (!vendor) return { brands: [], colors: [] };
    vendorId = vendor.id;
  }

  return getProductFacetsFromIndex({
    search: query.search,
    categoryIds,
    vendorId,
    size: query.size,
    minRating: query.minRating,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    saleOnly: query.saleOnly,
    secondHand: query.secondHand,
  });
}

export async function getProductBySlug(slug: string) {
  return findProductBySlug(slug);
}
