import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, productFavorites, productImages, productVariants, products, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

interface ListParams {
  status?: "draft" | "pending" | "active" | "inactive" | "rejected";
  search?: string;
  vendorId?: number;
  categoryId?: number;
  stock?: "low" | "out";
}

// products.php'deki stok/kategori filtrelerinin ve resim/favori/görüntülenme
// sütunlarının karşılığı - varyantı olan üründe stok product_variants'ta
// (SUM(stock)), varyantsız üründe products.stock'ta tutulur (bkz. aşağıdaki
// effectiveStock).
export async function listAllProducts({ status, search, vendorId, categoryId, stock }: ListParams) {
  const conditions = [];
  if (status) conditions.push(eq(products.status, status));
  if (vendorId) conditions.push(eq(products.vendorId, vendorId));
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli bireysel satıcıların ise stoğu 1 olacak" -
  // varyantı olan üründe stok variant toplamı, varyantsız üründe artık
  // products.stock (eskiden varyantsız ürünlerde stok kavramı hiç yoktu ve
  // filtrelere hiç dahil edilmiyorlardı, bkz. eski yorum aşağıda).
  const hasAnyVariant = sql<boolean>`EXISTS (SELECT 1 FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)})`;
  const effectiveStock = sql<number>`(CASE WHEN ${hasAnyVariant} THEN COALESCE((SELECT SUM(${productVariants.stock}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)}), 0) ELSE ${outer(products.stock)} END)`;
  if (stock === "out") conditions.push(sql`${effectiveStock} = 0`);
  if (stock === "low") conditions.push(sql`${effectiveStock} < 5`);

  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      status: products.status,
      viewCount: products.viewCount,
      createdAt: products.createdAt,
      vendorId: products.vendorId,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      categoryName: categories.name,
      image: sql<string | null>`(SELECT url FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC LIMIT 1)`,
      totalStock: effectiveStock,
      hasVariants: hasAnyVariant,
      favoriteCount: sql<number>`(SELECT COUNT(*) FROM ${productFavorites} WHERE ${productFavorites.productId} = ${outer(products.id)})`,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt))
    .limit(200);
}

export async function updateProductStatus(id: number, status: "draft" | "pending" | "active" | "inactive" | "rejected") {
  const [row] = await db.update(products).set({ status, updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id });
  return row ?? null;
}

export async function deleteProduct(id: number) {
  const result = await db.delete(products).where(eq(products.id, id)).returning({ id: products.id });
  return result.length > 0;
}

export async function countProductsByStatus() {
  const rows = await db.select({ status: products.status, count: sql<number>`COUNT(*)` }).from(products).groupBy(products.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}
