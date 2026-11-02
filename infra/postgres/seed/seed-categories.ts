// Kanonik kategori taksonomisi. Bu seed, production'daki kategori ağacını
// temiz bir veritabanında aynı slug, hiyerarşi, sıra ve görsellerle üretir.
// Upsert kullanıldığı için tekrar çalıştırılabilir; admin'in SEO alanlarını
// veya bu listenin dışındaki özel kategorilerini silmez.
import { db, pool } from "../../../apps/api/src/db/client";
import { categories } from "../../../apps/api/src/db/schema/index";

interface CategorySeed {
  name: string;
  slug: string;
  icon: string;
  image?: string;
  sortOrder: number;
  parentSlug?: string;
}

const CATEGORIES: CategorySeed[] = [
  { name: "Giyim", slug: "giyim", icon: "fas fa-shirt", image: "/category-images/category-ust-giyim.jpg", sortOrder: 1 },
  { name: "Aksesuar", slug: "aksesuar", icon: "fas fa-gem", image: "/category-images/category-aksesuarlar.jpg", sortOrder: 5 },
  { name: "Çantalar", slug: "cantalar", icon: "fas fa-bag-shopping", image: "/category-images/category-cantalar.jpg", sortOrder: 6 },
  { name: "Ayakkabılar", slug: "ayakkabilar", icon: "fas fa-shoe-prints", image: "/category-images/category-ayakkabilar.jpg", sortOrder: 7 },
  { name: "Kozmetik", slug: "kozmetik", icon: "fas fa-spray-can-sparkles", image: "/uploads/migrated/stock_cosmetics_wikimedia.jpg", sortOrder: 8 },
  { name: "Ev & Yaşam", slug: "ev-yasam", icon: "fas fa-house", image: "/uploads/migrated/stock_living_room_wikimedia.jpg", sortOrder: 9 },
  { name: "Spor & Outdoor", slug: "spor-outdoor", icon: "fas fa-person-running", image: "/uploads/migrated/stock_running_shoe_wikimedia.jpg", sortOrder: 10 },
  { name: "Çocuk", slug: "cocuk", icon: "🧸", sortOrder: 11 },
  { name: "Elbise", slug: "elbise", icon: "fas fa-person-dress", image: "/category-images/category-elbiseler.jpg", sortOrder: 1, parentSlug: "giyim" },
  { name: "Üst Giyim", slug: "ust-giyim", icon: "fas fa-shirt", image: "/category-images/category-bluzlar.jpg", sortOrder: 2, parentSlug: "giyim" },
  { name: "Alt Giyim", slug: "alt-giyim", icon: "fas fa-socks", image: "/category-images/category-alt-giyim.jpg", sortOrder: 3, parentSlug: "giyim" },
  { name: "Dış Giyim", slug: "dis-giyim", icon: "fas fa-vest", image: "/category-images/category-dis-giyim.jpg", sortOrder: 4, parentSlug: "giyim" },
  { name: "Erkek Çocuk", slug: "erkek-cocuk", icon: "👦", sortOrder: 1, parentSlug: "cocuk" },
  { name: "Kız Çocuk", slug: "kiz-cocuk", icon: "👧", sortOrder: 2, parentSlug: "cocuk" },
];

async function main() {
  await db.transaction(async (tx) => {
    const ids = new Map<string, number>();

    for (const category of CATEGORIES.filter((item) => !item.parentSlug)) {
      const [row] = await tx
        .insert(categories)
        .values({
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          image: category.image,
          sortOrder: category.sortOrder,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            parentId: null,
            name: category.name,
            icon: category.icon,
            image: category.image,
            sortOrder: category.sortOrder,
            isActive: true,
          },
        })
        .returning({ id: categories.id });
      ids.set(category.slug, row.id);
    }

    for (const category of CATEGORIES.filter((item) => item.parentSlug)) {
      const parentId = ids.get(category.parentSlug!);
      if (!parentId) throw new Error(`Kategori üst kaydı bulunamadı: ${category.parentSlug}`);
      const [row] = await tx
        .insert(categories)
        .values({
          parentId,
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          image: category.image,
          sortOrder: category.sortOrder,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            parentId,
            name: category.name,
            icon: category.icon,
            image: category.image,
            sortOrder: category.sortOrder,
            isActive: true,
          },
        })
        .returning({ id: categories.id });
      ids.set(category.slug, row.id);
    }
  });

  console.log(`${CATEGORIES.length} kanonik kategori seed edildi veya güncellendi.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("Kategori seed hatası:", err);
  await pool.end();
  process.exit(1);
});
