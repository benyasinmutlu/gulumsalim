// Eski gulumsalim.com sitesinin canlı ana sayfasından çıkarılan gerçek
// kategori taksonomisi (2026-07-19 itibarıyla). Site pre-launch aşamasında
// olduğu için ürün/satıcı/müşteri verisi taşınmıyor (bkz. mimari planı §6)
// ama kategori yapısı gerçek iş bilgisi olduğu için elle aktarılıyor.
import { db, pool } from "../../../apps/api/src/db/client";
import { categories } from "../../../apps/api/src/db/schema/index";

const CATEGORIES = [
  { name: "Elbiseler", slug: "elbiseler", sortOrder: 1 },
  { name: "Bluzlar", slug: "bluzlar", sortOrder: 2 },
  { name: "Üst Giyim", slug: "ust-giyim", sortOrder: 3 },
  { name: "Alt Giyim", slug: "alt-giyim", sortOrder: 4 },
  { name: "Pantolonlar", slug: "pantolonlar", sortOrder: 5 },
  { name: "Dış Giyim", slug: "dis-giyim", sortOrder: 6 },
  { name: "Etekler", slug: "etekler", sortOrder: 7 },
  { name: "Aksesuar", slug: "aksesuar", sortOrder: 8 },
  { name: "Ceketler", slug: "ceketler", sortOrder: 9 },
  { name: "Aksesuarlar", slug: "aksesuarlar", sortOrder: 10 },
];

async function main() {
  for (const c of CATEGORIES) {
    await db
      .insert(categories)
      .values(c)
      .onConflictDoNothing({ target: categories.slug });
  }
  console.log(`${CATEGORIES.length} kategori seed edildi (varsa mevcutlar atlandı).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Kategori seed hatası:", err);
  process.exit(1);
});
