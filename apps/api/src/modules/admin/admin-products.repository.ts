import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, products, vendors } from "../../db/schema/index";

interface ListParams {
  status?: "draft" | "active" | "inactive" | "rejected";
  search?: string;
  vendorId?: number;
}

export async function listAllProducts({ status, search, vendorId }: ListParams) {
  const conditions = [];
  if (status) conditions.push(eq(products.status, status));
  if (vendorId) conditions.push(eq(products.vendorId, vendorId));
  if (search) conditions.push(ilike(products.name, `%${search}%`));

  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      status: products.status,
      createdAt: products.createdAt,
      vendorId: products.vendorId,
      vendorStoreName: vendors.storeName,
      categoryName: categories.name,
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
