import { Meilisearch } from "meilisearch";
import { env } from "../config/env";
import { db } from "../db/client";
import { categories } from "../db/schema/index";
import { slugify } from "./slugify";

export const meiliClient = new Meilisearch({
  host: env.MEILISEARCH_URL,
  apiKey: env.MEILISEARCH_API_KEY,
});

export const PRODUCTS_INDEX = "products";

// bkz. denetim raporu madde 16: "Eş anlamlı kelimeler" - sabit/uydurma bir
// anlamsal eş anlamlı sözlüğü YERİNE, gerçek kategori adlarının Türkçe
// karaktersiz (ASCII) halini eş anlamlı sayar (ör. "Ayakkabı & Çanta" ↔
// "ayakkabi canta"). Bu, Türkçe klavyesi olmayan/otomatik düzeltmesi
// Türkçe karakterleri sildiği kullanıcıların gerçek kategori adlarını
// bulabilmesini sağlar - veri kaynaklı, tahmini değil.
async function buildCategorySynonyms(): Promise<Record<string, string[]>> {
  const rows = await db.select({ name: categories.name }).from(categories);
  const synonyms: Record<string, string[]> = {};
  for (const { name } of rows) {
    const folded = slugify(name).replace(/-/g, " ");
    const normalizedName = name.toLocaleLowerCase("tr-TR");
    if (folded && folded !== normalizedName) {
      synonyms[normalizedName] = [folded];
      synonyms[folded] = [normalizedName];
    }
  }
  return synonyms;
}

// Uygulama başlarken bir kere çağrılır (idempotent) - index yoksa
// oluşturur, ayarları (searchable/filterable/sortable alanlar) günceller.
// Meilisearch bu çağrıları arka planda kuyruğa alır, yanıtı beklemek
// gerekmez (bir sonraki arama zaten güncel ayarları kullanır).
export async function ensureProductsIndex() {
  const index = meiliClient.index(PRODUCTS_INDEX);
  await meiliClient.createIndex(PRODUCTS_INDEX, { primaryKey: "id" }).catch(() => {});
  await index.updateSearchableAttributes(["name", "brand", "description", "vendorName"]);
  await index.updateFilterableAttributes([
    "categoryId", "vendorId", "brand", "sizes", "inStockSizes", "colors", "visible", "onSale", "isSecondHand",
    // bkz. denetim raporu madde 11: "Ürün Durumu, Satıcı tipi, Ücretsiz kargo".
    "condition", "freeShipping", "vendorIsIndividual",
  ]);
  await index.updateSortableAttributes([
    "basePrice", "createdAt", "avgRating",
    // bkz. denetim raporu madde 12: "En çok satan / En çok beğenilen / En yüksek indirim".
    "salesCount", "favoriteCount", "discountPercent",
  ]);
  // bkz. denetim raporu madde 16: "Yazım hatası toleransı" - Meilisearch
  // varsayılanı zaten açık, burada AÇIKÇA belgeleniyor/sabitleniyor (ileride
  // sessizce değişmesin diye).
  await index.updateTypoTolerance({
    enabled: true,
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
  });
  await index.updateSynonyms(await buildCategorySynonyms()).catch(() => {});
}
