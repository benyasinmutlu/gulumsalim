import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, productFavorites, productImages, productVariants, products, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

interface ListParams {
  status?: "draft" | "active" | "inactive" | "rejected";
  search?: string;
  vendorId?: number;
  categoryId?: number;
  stock?: "low" | "out";
}

// products.php'deki stok/kategori filtrelerinin ve resim/favori/görüntülenme
// sütunlarının karşılığı - stok artık ürün başına değil varyant başına
// tutulduğu için (bkz. product_variants) SUM(stock) ile toplanır.
export async function listAllProducts({ status, search, vendorId, categoryId, stock }: ListParams) {
  const conditions = [];
  if (status) conditions.push(eq(products.status, status));
  if (vendorId) conditions.push(eq(products.vendorId, vendorId));
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  if (stock === "out") conditions.push(sql`COALESCE((SELECT SUM(${productVariants.stock}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)}), 0) = 0`);
  if (stock === "low") conditions.push(sql`COALESCE((SELECT SUM(${productVariants.stock}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)}), 0) < 5`);

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
      totalStock: sql<number>`COALESCE((SELECT SUM(${productVariants.stock}) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)}), 0)`,
      favoriteCount: sql<number>`(SELECT COUNT(*) FROM ${productFavorites} WHERE ${productFavorites.productId} = ${outer(products.id)})`,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt))
    .limit(200);
}

export async function updateProductStatus(id: number, status: "draft" | "active" | "inactive" | "rejected") {
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
