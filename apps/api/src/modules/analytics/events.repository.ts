import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { products } from "../../db/schema/index";

export async function findProductCategoryVendor(productId: number) {
  const [row] = await db
    .select({ categoryId: products.categoryId, vendorId: products.vendorId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return row ?? null;
}
