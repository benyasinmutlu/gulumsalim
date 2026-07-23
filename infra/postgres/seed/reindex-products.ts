// Meilisearch index'i sıfırdan kurulduğunda ya da veritabanıyla senkron
// dışı kaldığı şüphelenildiğinde çalıştırılır: tüm ürünleri tek seferde
// yeniden indeksler. Normal akışta ürün oluşturma/güncelleme/silme zaten
// canlı olarak indeksi günceller (bkz. search-index.service.ts).
import { pool } from "../../../apps/api/src/db/client";
import { ensureProductsIndex } from "../../../apps/api/src/lib/meilisearch";
import { reindexAllProducts } from "../../../apps/api/src/modules/catalog/search-index.service";

async function main() {
  await ensureProductsIndex();
  const count = await reindexAllProducts();
  console.log(`${count} ürün Meilisearch'e indekslendi.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Yeniden indeksleme hatası:", err);
  process.exit(1);
});
