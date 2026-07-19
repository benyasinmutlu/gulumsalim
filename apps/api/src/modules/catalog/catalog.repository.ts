import { and, desc, eq, gte, inArray, lte, lt, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, productImages, products, vendors } from "../../db/schema/index";
import type { Cursor } from "../../lib/pagination";

export async function listActiveCategories() {
  return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder);
}

export async function findCategoryBySlug(slug: string) {
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row ?? null;
}

interface ListProductsParams {
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  cursor?: Cursor | null;
  limit: number;
}

// Satıcı durumu her sorguda canlı kontrol edilir (JOIN + WHERE) - askıya
// alınan/yasaklanan bir satıcının ürünleri ayrı bir senkronizasyon işine
// gerek kalmadan anında görünmez olur.
export async function listActiveProducts(params: ListProductsParams) {
  const conditions: SQL[] = [eq(products.status, "active"), eq(vendors.status, "active")];
  if (params.categoryId !== undefined) conditions.push(eq(products.categoryId, params.categoryId));
  if (params.minPrice !== undefined) conditions.push(gte(products.basePrice, String(params.minPrice)));
  if (params.maxPrice !== undefined) conditions.push(lte(products.basePrice, String(params.maxPrice)));
  if (params.cursor) {
    const cursorDate = new Date(params.cursor.createdAt);
    const cursorCondition = or(
      lt(products.createdAt, cursorDate),
      and(eq(products.createdAt, cursorDate), lt(products.id, params.cursor.id)),
    );
    if (cursorCondition) conditions.push(cursorCondition);
  }

  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      createdAt: products.createdAt,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt), desc(products.id))
    // Bir fazla satır çekilir: sıradaki sayfa var mı yok mu, ekstra bir
    // COUNT sorgusu atmadan bu şekilde anlaşılır.
    .limit(params.limit + 1);
}

// Go keşfet servisinden dönen ürün ID'lerini ürün kartı verisine çevirir.
// Sıralama çağıran tarafından (bkz. discovery.service.ts) skor sırasına
// göre yeniden kurulur - IN (...) sorgusu sıra garantisi vermez.
export async function findProductsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      createdAt: products.createdAt,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(inArray(products.id, ids), eq(products.status, "active"), eq(vendors.status, "active")));
}

export async function findProductBySlug(slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      categoryId: products.categoryId,
      vendorId: products.vendorId,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active"), eq(vendors.status, "active")))
    .limit(1);
  if (!product) return null;

  const images = await db
    .select({ url: productImages.url, isPrimary: productImages.isPrimary, sortOrder: productImages.sortOrder })
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(productImages.sortOrder);

  return { ...product, images };
}
