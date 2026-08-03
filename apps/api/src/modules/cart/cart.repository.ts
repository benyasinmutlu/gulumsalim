import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { productImages, products, productVariants, vendors } from "../../db/schema/index";

export async function fetchProductsForCart(productIds: number[]) {
  if (productIds.length === 0) return [];
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      status: products.status,
      vendorStatus: vendors.status,
      freeShipping: products.freeShipping,
      stock: products.stock,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(inArray(products.id, productIds));
}

export async function fetchVariantsForCart(variantIds: number[]) {
  if (variantIds.length === 0) return [];
  return db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      priceOverride: productVariants.priceOverride,
      stock: productVariants.stock,
      size: productVariants.size,
      color: productVariants.color,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));
}

export async function fetchPrimaryImages(productIds: number[]) {
  if (productIds.length === 0) return [];
  return db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true)));
}
