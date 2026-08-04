import { and, avg, count, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { categories, productReviews, products, productVariants, vendors } from "../../db/schema/index";
import { meiliClient, PRODUCTS_INDEX } from "../../lib/meilisearch";
import { attachPrimaryImages } from "./catalog.repository";

// Meilisearch dokümanı - Postgres ana kaynak olarak kalır, bu sadece bir
// arama/filtre projeksiyonu. `visible`, ürünün VE satıcının aynı anda aktif
// olup olmadığını yakalar - sorgu tarafında iki ayrı JOIN yerine tek bir
// filtrelenebilir alan.
async function buildProductDocument(productId: number) {
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      brand: products.brand,
      basePrice: products.basePrice,
      compareAtPrice: products.compareAtPrice,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      vendorId: products.vendorId,
      vendorName: vendors.storeName,
      vendorSlug: vendors.storeSlug,
      createdAt: products.createdAt,
      isSecondHand: products.isSecondHand,
      vendorType: vendors.vendorType,
      productStatus: products.status,
      vendorStatus: vendors.status,
    })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) return null;

  const [variants, ratingRow, [withImage]] = await Promise.all([
    db
      .select({ size: productVariants.size, color: productVariants.color })
      .from(productVariants)
      .where(eq(productVariants.productId, productId)),
    db
      .select({ average: avg(productReviews.rating), total: count(productReviews.id) })
      .from(productReviews)
      .where(and(eq(productReviews.productId, productId), eq(productReviews.status, "approved"))),
    attachPrimaryImages([{ id: row.id }]),
  ]);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    basePrice: Number(row.basePrice),
    compareAtPrice: row.compareAtPrice ? Number(row.compareAtPrice) : null,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    vendorId: row.vendorId,
    vendorName: row.vendorName,
    vendorSlug: row.vendorSlug,
    primaryImageUrl: withImage?.primaryImageUrl ?? null,
    createdAt: row.createdAt.getTime(),
    sizes: [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))],
    colors: [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))],
    avgRating: ratingRow[0]?.average ? Number(ratingRow[0].average) : 0,
    reviewCount: ratingRow[0]?.total ?? 0,
    onSale: row.compareAtPrice !== null,
    isSecondHand: row.isSecondHand,
    vendorIsIndividual: row.vendorType === "individual",
    visible: row.productStatus === "active" && row.vendorStatus === "active",
  };
}

export async function syncProductToIndex(productId: number) {
  const doc = await buildProductDocument(productId);
  if (!doc) {
    await meiliClient.index(PRODUCTS_INDEX).deleteDocument(productId).catch(() => {});
    return;
  }
  await meiliClient.index(PRODUCTS_INDEX).addDocuments([doc]);
}

export async function removeProductFromIndex(productId: number) {
  await meiliClient.index(PRODUCTS_INDEX).deleteDocument(productId).catch(() => {});
}

// Bir satıcının durumu değiştiğinde (onay/askıya alma/yasaklama) tüm
// ürünlerinin `visible` alanı yeniden hesaplanmalı.
export async function reindexVendorProducts(vendorId: number) {
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.vendorId, vendorId));
  await Promise.all(rows.map((r) => syncProductToIndex(r.id)));
}

// Sunucu ilk kurulduğunda ya da index sıfırdan oluşturulduğunda mevcut tüm
// ürünleri tek seferde indeksler (bkz. infra/postgres/seed script'i).
export async function reindexAllProducts() {
  const rows = await db.select({ id: products.id }).from(products);
  const liveIds = new Set(rows.map((r) => r.id));
  const docs = (await Promise.all(rows.map((r) => buildProductDocument(r.id)))).filter((d) => d !== null);
  const index = meiliClient.index(PRODUCTS_INDEX);
  if (docs.length > 0) {
    await index.addDocuments(docs);
  }
  // Postgres'te artık olmayan (ör. doğrudan SQL ile silinmiş) belgeleri
  // index'ten temizle - aksi halde "hayalet" ürünler filtreli aramalarda
  // sonsuza dek görünmeye devam eder.
  const existing = await index.getDocuments({ limit: 10000, fields: ["id"] });
  const staleIds = existing.results.map((d) => d.id as number).filter((id) => !liveIds.has(id));
  if (staleIds.length > 0) {
    await index.deleteDocuments(staleIds);
  }
  return docs.length;
}
