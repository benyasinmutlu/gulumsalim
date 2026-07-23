import { and, desc, eq, gte, ilike, inArray, isNotNull, lte, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, productFavorites, productImages, productReviews, products, productVariants, vendors } from "../../db/schema/index";

// Ürün listesi sorgularında (listActiveProducts, findProductsByIds) tekrar
// eden puan/yorum sayısı hesaplaması - korelasyonlu alt sorgu, sadece
// onaylanmış (approved) değerlendirmeleri sayar. AVG() sürücü seviyesinde
// string (veya kayıt yoksa null) döner, bu yüzden mapWith yerine çağıran
// tarafta elle Number()'a çevrilir (bkz. attachRatings).
const avgRatingExpr = sql<string | null>`(SELECT AVG(rating) FROM ${productReviews} WHERE ${productReviews.productId} = ${products.id} AND ${productReviews.status} = 'approved')`;
const reviewCountExpr = sql<number>`(SELECT COUNT(*) FROM ${productReviews} WHERE ${productReviews.productId} = ${products.id} AND ${productReviews.status} = 'approved')`.mapWith(
  Number,
);

function attachRatings<T extends { avgRating: string | null; reviewCount: number }>(
  rows: T[],
): (Omit<T, "avgRating"> & { avgRating: number | null })[] {
  return rows.map((row) => ({ ...row, avgRating: row.avgRating !== null ? Number(row.avgRating) : null }));
}
import type { Cursor } from "../../lib/pagination";

// Idempotent değil, kasıtlı olarak "aç/kapat" - favori zaten varsa siler,
// yoksa ekler. Tek sorguda karar vermek için önce insert denenir
// (onConflictDoNothing), sonuç boşsa (satır zaten vardı) silme yapılır.
export async function toggleFavorite(customerId: number, productId: number): Promise<boolean> {
  const inserted = await db
    .insert(productFavorites)
    .values({ customerId, productId })
    .onConflictDoNothing({ target: [productFavorites.customerId, productFavorites.productId] })
    .returning();
  if (inserted.length > 0) return true;

  await db
    .delete(productFavorites)
    .where(and(eq(productFavorites.customerId, customerId), eq(productFavorites.productId, productId)));
  return false;
}

export async function listActiveCategories() {
  return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder);
}

// gulumsalim.com'daki hesabım sayfasının favori ürünler listesinin
// karşılığı - toggle uç noktası zaten vardı, listeleme yoktu.
export async function listFavoritesByCustomer(customerId: number) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      createdAt: products.createdAt,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      avgRating: avgRatingExpr,
      reviewCount: reviewCountExpr,
    })
    .from(productFavorites)
    .innerJoin(products, eq(productFavorites.productId, products.id))
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(productFavorites.customerId, customerId), eq(products.status, "active"), eq(vendors.status, "active")))
    .orderBy(desc(productFavorites.createdAt));

  return attachPrimaryImages(attachRatings(rows));
}

export async function findCategoryBySlug(slug: string) {
  const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return row ?? null;
}

export async function findActiveProductIdBySlug(slug: string) {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active"), eq(vendors.status, "active")))
    .limit(1);
  return row ?? null;
}

interface ListProductsParams {
  categoryId?: number;
  vendorId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  saleOnly?: boolean;
  cursor?: Cursor | null;
  limit: number;
}

// Satıcı durumu her sorguda canlı kontrol edilir (JOIN + WHERE) - askıya
// alınan/yasaklanan bir satıcının ürünleri ayrı bir senkronizasyon işine
// gerek kalmadan anında görünmez olur.
export async function listActiveProducts(params: ListProductsParams) {
  const conditions: SQL[] = [eq(products.status, "active"), eq(vendors.status, "active")];
  if (params.categoryId !== undefined) conditions.push(eq(products.categoryId, params.categoryId));
  if (params.vendorId !== undefined) conditions.push(eq(products.vendorId, params.vendorId));
  if (params.minPrice !== undefined) conditions.push(gte(products.basePrice, String(params.minPrice)));
  if (params.maxPrice !== undefined) conditions.push(lte(products.basePrice, String(params.maxPrice)));
  // Bu sade gözatma yolu kasıtlı olarak ILIKE kullanır - tam metin arama/facet
  // filtreleri istendiğinde catalog.service.ts isteği Meilisearch'e yönlendirir
  // (bkz. needsSearchIndex/catalog.search.ts), bu fonksiyona hiç uğramaz.
  if (params.search) conditions.push(ilike(products.name, `%${params.search}%`));
  if (params.saleOnly) conditions.push(isNotNull(products.compareAtPrice));
  if (params.cursor) {
    const cursorDate = new Date(params.cursor.createdAt);
    const cursorCondition = or(
      lt(products.createdAt, cursorDate),
      and(eq(products.createdAt, cursorDate), lt(products.id, params.cursor.id)),
    );
    if (cursorCondition) conditions.push(cursorCondition);
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      createdAt: products.createdAt,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      categorySlug: categories.slug,
      avgRating: avgRatingExpr,
      reviewCount: reviewCountExpr,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt), desc(products.id))
    // Bir fazla satır çekilir: sıradaki sayfa var mı yok mu, ekstra bir
    // COUNT sorgusu atmadan bu şekilde anlaşılır.
    .limit(params.limit + 1);

  return attachPrimaryImages(attachRatings(rows));
}

// Liste sorgularında görsel, ayrı bir toplu sorguyla eklenir (findProductBySlug'ın
// tekil ürün için yaptığı ikinci sorguyla aynı desen) - JOIN ile "ürün başına
// tek görsel" almak subquery/lateral gerektirirdi, bu daha basit ve okunması kolay.
export async function attachPrimaryImages<T extends { id: number }>(
  rows: T[],
): Promise<(T & { primaryImageUrl: string | null })[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const images = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(and(inArray(productImages.productId, ids), eq(productImages.isPrimary, true)));
  const byProductId = new Map(images.map((img) => [img.productId, img.url]));
  return rows.map((row) => ({ ...row, primaryImageUrl: byProductId.get(row.id) ?? null }));
}

// Go keşfet servisinden dönen ürün ID'lerini ürün kartı verisine çevirir.
// Sıralama çağıran tarafından (bkz. discovery.service.ts) skor sırasına
// göre yeniden kurulur - IN (...) sorgusu sıra garantisi vermez.
// NOT: `ids` sırası anlamlıdır (çağıran taraf best-seller/yeni gelen/
// kişiselleştirilmiş sıralamasını burada belirler - bkz.
// homepage-sections.service.ts). Düz "WHERE id IN (...)" Postgres'te GİRİŞ
// SIRASINI KORUMAZ (genelde fiziksel/PK sırasına döner) - bu yüzden
// array_position ile açıkça o sıraya göre ORDER BY yapılıyor.
export async function findProductsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const orderArray = sql.raw(`ARRAY[${ids.map((id) => Number(id)).join(",")}]::bigint[]`);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      createdAt: products.createdAt,
      vendorStoreName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      categorySlug: categories.slug,
      avgRating: avgRatingExpr,
      reviewCount: reviewCountExpr,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(inArray(products.id, ids), eq(products.status, "active"), eq(vendors.status, "active")))
    .orderBy(sql`array_position(${orderArray}, ${products.id})`);

  return attachPrimaryImages(attachRatings(rows));
}

export async function findProductBySlug(slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      brand: products.brand,
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

  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      priceOverride: productVariants.priceOverride,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .orderBy(productVariants.id);

  return { ...product, images, variants };
}

// gulumsalim.com'daki products.views sayacının karşılığı - admin
// dashboard'daki "En Çok Görüntülenen Ürünler" için.
export async function incrementProductViewCount(productId: number) {
  await db.update(products).set({ viewCount: sql`${products.viewCount} + 1` }).where(eq(products.id, productId));
}
