import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, products } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";
import type { createCategorySchema, updateCategorySchema } from "./admin-categories.schemas";
import type { z } from "zod";

export async function listCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      parentId: categories.parentId,
      name: categories.name,
      slug: categories.slug,
      icon: categories.icon,
      iconColor: categories.iconColor,
      image: categories.image,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      seoTitle: categories.seoTitle,
      seoDescription: categories.seoDescription,
      seoKeywords: categories.seoKeywords,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.categoryId} = ${outer(categories.id)})`,
      childCount: sql<number>`(SELECT COUNT(*) FROM ${categories} c2 WHERE c2.parent_id = ${outer(categories.id)})`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function createCategory(input: z.infer<typeof createCategorySchema>) {
  const [row] = await db.insert(categories).values(input).returning();
  return row!;
}

export async function updateCategory(id: number, input: z.infer<typeof updateCategorySchema>) {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  return row ?? null;
}

export class CategoryHasProductsError extends Error {}
export class CategoryHasChildrenError extends Error {}

export async function deleteCategoryIfEmpty(id: number) {
  const [[productRow], [childRow]] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.categoryId, id)),
    db.select({ count: sql<number>`COUNT(*)` }).from(categories).where(eq(categories.parentId, id)),
  ]);
  if (Number(productRow?.count ?? 0) > 0) throw new CategoryHasProductsError();
  if (Number(childRow?.count ?? 0) > 0) throw new CategoryHasChildrenError();
  const result = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  return result.length > 0;
}

export async function updateCategoryImage(id: number, image: string) {
  const [row] = await db.update(categories).set({ image }).where(eq(categories.id, id)).returning();
  return row ?? null;
}
