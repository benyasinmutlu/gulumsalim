import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { productFavorites, productImages, products, productVariants } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

// bkz. kullanıcı isteği: "satıcı panelinde ... ürünlerine kaç kişi baktı
// ... favorideyse de göster" - viewCount zaten products tablosunda vardı
// (products.viewCount, bkz. catalog.repository.ts incrementProductViewCount)
// ama satıcı panelinde hiç gösterilmiyordu; favoriteCount burada eklendi.
// Sepet sayısı (cartCount) Redis'te tutulduğu için burada değil, route
// katmanında ayrıca eklenir (bkz. vendor-products.routes.ts).
export async function listVendorProducts(vendorId: number) {
  return db
    .select({
      id: products.id,
      vendorId: products.vendorId,
      categoryId: products.categoryId,
      name: products.name,
      slug: products.slug,
      description: products.description,
      brand: products.brand,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      freeShipping: products.freeShipping,
      isSecondHand: products.isSecondHand,
      status: products.status,
      viewCount: products.viewCount,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      favoriteCount: sql<number>`(SELECT COUNT(*) FROM ${productFavorites} WHERE ${productFavorites.productId} = ${outer(products.id)})`.mapWith(
        Number,
      ),
      // bkz. kullanıcı isteği: "ürünleri düzenleyebilmeli stok durumunu
      // görsel başlık vs vs" - liste ekranında hiç stok/görsel yoktu, her
      // ürünü tek tek açmadan durumu görmek imkansızdı.
      totalStock: sql<number>`(SELECT COALESCE(SUM(${productVariants.stock}), 0) FROM ${productVariants} WHERE ${productVariants.productId} = ${outer(products.id)})`.mapWith(
        Number,
      ),
      primaryImageUrl: sql<string | null>`(SELECT ${productImages.url} FROM ${productImages} WHERE ${productImages.productId} = ${outer(products.id)} ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC LIMIT 1)`,
    })
    .from(products)
    .where(eq(products.vendorId, vendorId))
    .orderBy(desc(products.createdAt));
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
  freeShipping?: boolean;
  isSecondHand?: boolean;
}

interface ProductCreateInput {
  categoryId: number;
  name: string;
  slug: string;
  description?: string;
  brand?: string;
  basePrice: string;
  compareAtPrice?: string;
  isSecondHand?: boolean;
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

// bkz. kullanıcı isteği: "burda ürünleri düzenleyebilmeli ... görsel" -
// önceki denetimde bir ürünün ANA (vitrin) görselini yükledikten sonra
// değiştirmenin hiçbir yolu olmadığı tespit edildi, sadece ilk yüklenen
// görsel kalıcı olarak ana görsel kalıyordu.
export async function setPrimaryProductImage(productId: number, imageId: number) {
  return db.transaction(async (tx) => {
    await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));
  });
}

export async function listProductVariants(productId: number) {
  return db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(productVariants.id);
}

interface VariantWriteInput {
  sku?: string;
  size?: string;
  color?: string;
  priceOverride?: string;
  stock: number;
}

// bkz. kullanıcı isteği: "her şeyiyle sku'yu otomatik oluştursun sistem" -
// {ürün id}-{beden}-{renk}-{rastgele 4 karakter} biçiminde, hem okunabilir
// (hangi ürüne/bedene/renge ait olduğu tek bakışta anlaşılır) hem de
// benzersizliği rastgele son ekle garanti eden bir SKU. Beden/renk
// verilmediyse "STD" (standart) kullanılır.
function slugifyPart(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const cleaned = value
    .toLocaleUpperCase("tr-TR")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U")
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 6);
  return cleaned || fallback;
}

function generateVariantSku(productId: number, size?: string, color?: string): string {
  const sizePart = slugifyPart(size, "STD");
  const colorPart = color ? slugifyPart(color, "") : "";
  const randomPart = randomBytes(3).toString("hex").toUpperCase();
  return [productId, sizePart, colorPart, randomPart].filter(Boolean).join("-");
}

// SKU'nun UNIQUE kısıtlaması var - rastgele son ek çakışması istatistiksel
// olarak neredeyse imkansız ama yine de birkaç deneme ile kendini onarır,
// tek seferlik bir hataya karşı satıcının işlemi tekrar denemesini istemez.
export async function insertProductVariant(productId: number, data: VariantWriteInput) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sku = data.sku?.trim() || generateVariantSku(productId, data.size, data.color);
    try {
      const [row] = await db
        .insert(productVariants)
        .values({ ...data, sku, productId })
        .returning();
      if (!row) throw new Error("Varyant oluşturulamadı");
      return row;
    } catch (err) {
      const isUniqueViolation = (err as { code?: string })?.code === "23505";
      // Satıcının kendi girdiği SKU çakıştıysa tekrar denemek anlamsız -
      // ona anlamlı bir hata dönmesi gerekir, otomatik üretilen SKU
      // çakıştıysa (son derece nadir) sessizce yeni bir tane denenir.
      if (!isUniqueViolation || data.sku?.trim() || attempt === maxAttempts) throw err;
    }
  }
  throw new Error("Varyant oluşturulamadı");
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
