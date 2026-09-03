import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { productImages, products, productVariants, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

export interface ProductReadinessState {
  vendorType: "business" | "individual";
  stock: number;
  hasDefect: boolean;
  generalImageCount: number;
  defectPhotoCount: number;
  variantCount: number;
  variantStock: number;
}

export class ProductNotReadyError extends Error {
  constructor(public issues: string[]) {
    super(issues.join(" "));
  }
}

export function productReadinessIssues(
  state: ProductReadinessState,
  overrides: { stock?: number; hasDefect?: boolean } = {},
): string[] {
  const issues: string[] = [];
  const hasDefect = overrides.hasDefect ?? state.hasDefect;
  const effectiveStock = state.variantCount > 0 ? state.variantStock : (overrides.stock ?? state.stock);

  if (state.generalImageCount < 1) issues.push("En az bir ürün görseli yüklemelisiniz.");
  if (hasDefect && state.defectPhotoCount < 1) issues.push("Kusurlu ürün için ayrı kusur fotoğrafı yüklemelisiniz.");
  if (effectiveStock <= 0) issues.push("Yayınlamadan önce pozitif stok girmelisiniz.");
  return issues;
}

export async function getProductReadiness(productId: number): Promise<ProductReadinessState | null> {
  const [row] = await db
    .select({
      vendorType: vendors.vendorType,
      stock: products.stock,
      hasDefect: products.hasDefect,
      generalImageCount: sql<number>`(SELECT COUNT(*) FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} AND ${productImages.isDefectPhoto} = false)`.mapWith(Number),
      defectPhotoCount: sql<number>`(SELECT COUNT(*) FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} AND ${productImages.isDefectPhoto} = true)`.mapWith(Number),
      variantCount: sql<number>`(SELECT COUNT(*) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)})`.mapWith(Number),
      variantStock: sql<number>`(SELECT COALESCE(SUM(${productVariants.stock}), 0) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)})`.mapWith(Number),
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(eq(products.id, productId))
    .limit(1);
  return row ?? null;
}

export async function assertProductReadyForPublication(
  productId: number,
  overrides: { stock?: number; hasDefect?: boolean } = {},
) {
  const state = await getProductReadiness(productId);
  if (!state) return;
  const issues = productReadinessIssues(state, overrides);
  if (issues.length > 0) throw new ProductNotReadyError(issues);
}
