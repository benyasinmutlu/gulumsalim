import { Meilisearch } from "meilisearch";
import { env } from "../config/env";

export const meiliClient = new Meilisearch({
  host: env.MEILISEARCH_URL,
  apiKey: env.MEILISEARCH_API_KEY,
});

export const PRODUCTS_INDEX = "products";

// Uygulama başlarken bir kere çağrılır (idempotent) - index yoksa
// oluşturur, ayarları (searchable/filterable/sortable alanlar) günceller.
// Meilisearch bu çağrıları arka planda kuyruğa alır, yanıtı beklemek
// gerekmez (bir sonraki arama zaten güncel ayarları kullanır).
export async function ensureProductsIndex() {
  const index = meiliClient.index(PRODUCTS_INDEX);
  await meiliClient.createIndex(PRODUCTS_INDEX, { primaryKey: "id" }).catch(() => {});
  await index.updateSearchableAttributes(["name", "brand", "description", "vendorName"]);
  await index.updateFilterableAttributes(["categoryId", "vendorId", "brand", "sizes", "colors", "visible", "onSale"]);
  await index.updateSortableAttributes(["basePrice", "createdAt", "avgRating"]);
}
