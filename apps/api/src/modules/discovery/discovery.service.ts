import { findProductsByIds } from "../catalog/catalog.repository";
import { fetchDiscoverFeed } from "./discovery.client";

export async function getDiscoverFeed(customerId: number | undefined, limit: number) {
  const result = await fetchDiscoverFeed(customerId, limit);
  if (result.productIds.length === 0) {
    return { items: [], strategy: result.strategy };
  }

  const products = await findProductsByIds(result.productIds);
  const productMap = new Map(products.map((p) => [p.id, p]));
  // Go servisinin döndürdüğü skor sırası korunur - IN (...) sorgusu bunu
  // garanti etmez, elle yeniden sıralanır.
  const items = result.productIds.map((id) => productMap.get(id)).filter((p) => p !== undefined);

  return { items, strategy: result.strategy };
}
