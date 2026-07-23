import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { productImages, products, productVariants } from "../../db/schema/index";

export async function listVendorProducts(vendorId: number) {
  return db.select().from(products).where(eq(products.vendorId, vendorId)).orderBy(desc(products.createdAt));
}

export async function findVendorProduct(vendorId: number, productId: number) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

export async function findProductBySlugAnyVendor(slug: string) {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  return row ?? null;
}

interface ProductWriteInput {
  categoryId?: number;
  name?: string;
  slug?: string;
  description?: string;
  brand?: string;
  basePrice?: string;
  compareAtPrice?: string;
  status?: "draft" | "active" | "inactive";
}

interface ProductCreateInput {
  categoryId: number;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  basePrice: string;
  compareAtPrice?: string;
}

export async function insertVendorProduct(vendorId: number, data: ProductCreateInput) {
  const [row] = await db
    .insert(products)
    .values({ ...data, vendorId })
    .returning();
  if (!row) throw new Error("Ürün oluşturulamadı");
  return row;
}

export async function updateVendorProduct(vendorId: number, productId: number, data: ProductWriteInput) {
  const [row] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
    .returning();
  return row ?? null;
}

export async function deleteVendorProduct(vendorId: number, productId: number) {
  const result = await db
    .delete(products)
    .where(and(eq(products.id, productId), eq(products.vendorId, vendorId)))
    .returning({ id: products.id });
  return result.length > 0;
}

export async function listProductImages(productId: number) {
  return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(productImages.sortOrder);
}

export async function insertProductImage(productId: number, url: string, isPrimary: boolean, sortOrder: number) {
  const [row] = await db.insert(productImages).values({ productId, url, isPrimary, sortOrder }).returning();
  if (!row) throw new Error("Görsel kaydedilemedi");
  return row;
}

export async function findProductImageOwnedByVendor(vendorId: number, imageId: number) {
  const [row] = await db
    .select({ id: productImages.id, productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .innerJoin(products, eq(productImages.productId, products.id))
    .where(and(eq(productImages.id, imageId), eq(products.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

export async function deleteProductImageById(imageId: number) {
  await db.delete(productImages).where(eq(productImages.id, imageId));
}

export async function listProductVariants(productId: number) {
  return db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(productVariants.id);
}

interface VariantWriteInput {
  sku: string;
  size?: string;
  color?: string;
  priceOverride?: string;
  stock: number;
}

export async function insertProductVariant(productId: number, data: VariantWriteInput) {
  const [row] = await db
    .insert(productVariants)
    .values({ ...data, productId })
    .returning();
  if (!row) throw new Error("Varyant oluşturulamadı");
  return row;
}

// Görsellerdeki (findProductImageOwnedByVendor) desenle aynı: mülkiyet
// kontrolü ayrı bir sorguyla yapılır, sonra sade bir id'ye göre yazma
// işlemi çalışır - drizzle'da UPDATE...FROM join'i belirsiz olduğundan
// bu iki adımlı yaklaşım daha güvenilir.
export async function findVariantOwnedByVendor(vendorId: number, variantId: number) {
  const [row] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.id, variantId), eq(products.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

export async function updateProductVariant(variantId: number, data: Partial<VariantWriteInput>) {
  const [row] = await db.update(productVariants).set(data).where(eq(productVariants.id, variantId)).returning();
  return row ?? null;
}

export async function deleteProductVariant(variantId: number) {
  await db.delete(productVariants).where(eq(productVariants.id, variantId));
}
