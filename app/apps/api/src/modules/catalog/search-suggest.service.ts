import { and, eq, ilike } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, vendors } from "../../db/schema/index";
import { meiliClient, PRODUCTS_INDEX } from "../../lib/meilisearch";

export type SearchSuggestion =
  | {
      kind: "product";
      id: number;
      name: string;
      slug: string;
      basePrice: string;
      categorySlug: string;
      primaryImageUrl: string | null;
    }
  | { kind: "category"; id: number; name: string; slug: string }
  | { kind: "vendor"; id: number; storeName: string; storeSlug: string; logo: string | null };

// Başlık çubuğundaki canlı arama önerisi - ürün/kategori/mağaza karışık,
// gulumsalim.com'daki search-suggest.php'nin karşılığı. Her tür için ayrı
// küçük bir sorgu (tek büyük UNION yerine) - üç farklı kaynağın (Meilisearch
// + iki Postgres tablosu) doğal sınırı zaten bu.
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  const [productHits, categoryRows, vendorRows] = await Promise.all([
    meiliClient
      .index(PRODUCTS_INDEX)
      .search(query, { filter: "visible = true", limit: 5 }),
    db.select().from(categories).where(and(ilike(categories.name, `%${query}%`), eq(categories.isActive, true))).limit(3),
    db.select().from(vendors).where(and(ilike(vendors.storeName, `%${query}%`), eq(vendors.status, "active"))).limit(3),
  ]);

  const products: SearchSuggestion[] = productHits.hits.map((hit) => {
    const doc = hit as {
      id: number;
      name: string;
      slug: string;
      basePrice: number;
      categorySlug: string;
      primaryImageUrl: string | null;
    };
    return {
      kind: "product",
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      basePrice: doc.basePrice.toFixed(2),
      categorySlug: doc.categorySlug,
      primaryImageUrl: doc.primaryImageUrl,
    };
  });

  const categorySuggestions: SearchSuggestion[] = categoryRows.map((c) => ({
    kind: "category",
    id: c.id,
    name: c.name,
    slug: c.slug,
  }));

  const vendorSuggestions: SearchSuggestion[] = vendorRows.map((v) => ({
    kind: "vendor",
    id: v.id,
    storeName: v.storeName,
    storeSlug: v.storeSlug,
    logo: v.logo,
  }));

  return [...categorySuggestions, ...vendorSuggestions, ...products];
}

// search.php'deki birleşik arama sonuç sayfasının karşılığı - /arama
// sayfasının üst kısmında "Mağazalar (N)" ve kategori eşleşmelerini
// göstermek için, ürün sonuçlarından (bunlar zaten /products?search= ile
// ayrıca sayfalanıyor) bağımsız, daha geniş limitli bir sorgu.
export async function getSearchMatches(query: string) {
  const [categoryRows, vendorRows] = await Promise.all([
    db.select().from(categories).where(and(ilike(categories.name, `%${query}%`), eq(categories.isActive, true))).limit(8),
    db
      .select({ id: vendors.id, storeName: vendors.storeName, storeSlug: vendors.storeSlug, logo: vendors.logo })
      .from(vendors)
      .where(and(ilike(vendors.storeName, `%${query}%`), eq(vendors.status, "active")))
      .limit(8),
  ]);

  return {
    categories: categoryRows.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    vendors: vendorRows,
  };
}
