import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { collectionProducts, collections, productImages, products } from "../../db/schema/index";
import type { createCollectionSchema, updateCollectionSchema } from "./vendor-collections.schemas";
import type { z } from "zod";

export async function listVendorCollections(vendorId: number) {
  return db.select().from(collections).where(eq(collections.vendorId, vendorId)).orderBy(asc(collections.sortOrder));
}

export async function createCollection(vendorId: number, input: z.infer<typeof createCollectionSchema>) {
  const [row] = await db.insert(collections).values({ vendorId, ...input }).returning();
  return row!;
}

export async function findVendorCollection(vendorId: number, id: number) {
  const [row] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.vendorId, vendorId))).limit(1);
  return row ?? null;
}

export async function updateCollection(vendorId: number, id: number, input: z.infer<typeof updateCollectionSchema>) {
  const [row] = await db
    .update(collections)
    .set(input)
    .where(and(eq(collections.id, id), eq(collections.vendorId, vendorId)))
    .returning();
  return row ?? null;
}

export async function updateCollectionImage(vendorId: number, id: number, coverImage: string) {
  const [row] = await db
    .update(collections)
    .set({ coverImage })
    .where(and(eq(collections.id, id), eq(collections.vendorId, vendorId)))
    .returning();
  return row ?? null;
}

export async function deleteCollection(vendorId: number, id: number) {
  return db.transaction(async (tx) => {
    // Önce mülkiyeti aynı transaction içinde doğrula. Eski sıra doğrudan
    // collection_products satırlarını siliyor, koleksiyon başka mağazaya aitse
    // asıl DELETE başarısız olsa bile o mağazanın ürün bağları kayboluyordu.
    const [owned] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.vendorId, vendorId)))
      .limit(1);
    if (!owned) return false;

    await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, id));
    const result = await tx
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.vendorId, vendorId)))
      .returning({ id: collections.id });
    return result.length > 0;
  });
}

export async function listCollectionProducts(collectionId: number) {
  return db
    .select({
      id: collectionProducts.id,
      productId: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      sortOrder: collectionProducts.sortOrder,
      imageUrl: productImages.url,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(collectionProducts.productId, products.id))
    .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
    .where(eq(collectionProducts.collectionId, collectionId))
    .orderBy(asc(collectionProducts.sortOrder), asc(collectionProducts.id));
}

// bkz. kullanıcı isteği: "koleksiyon sayfası nasıl gözükecek hangi ürünler
// olacak" - sortOrder verilmezse önceki denetimde HER ürün 0 alıyordu,
// yani sıraları tanımsızdı. Artık son sıradan sonraya eklenir, vitrindeki
// gerçek gösterim sırası eklenme sırasıyla eşleşir.
export async function addProductToCollection(collectionId: number, productId: number, sortOrder?: number) {
  return db.transaction(async (tx) => {
    // Collection row lock aynı koleksiyona eşzamanlı eklemeleri sıraya dizer;
    // MAX+1 hesabı ve INSERT tek transaction sınırında kalır.
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1)
      .for("update");
    if (!collection) return null;

    let nextSortOrder = sortOrder;
    if (nextSortOrder === undefined) {
      const [last] = await tx
      .select({ sortOrder: collectionProducts.sortOrder })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId))
      .orderBy(desc(collectionProducts.sortOrder), desc(collectionProducts.id))
      .limit(1);
      nextSortOrder = (last?.sortOrder ?? -1) + 1;
    }
    const [row] = await tx
      .insert(collectionProducts)
      .values({ collectionId, productId, sortOrder: nextSortOrder })
      .onConflictDoNothing({ target: [collectionProducts.collectionId, collectionProducts.productId] })
      .returning();
    return row ?? null;
  });
}

export async function removeProductFromCollection(collectionId: number, productId: number) {
  const result = await db
    .delete(collectionProducts)
    .where(and(eq(collectionProducts.collectionId, collectionId), eq(collectionProducts.productId, productId)))
    .returning({ id: collectionProducts.id });
  return result.length > 0;
}

// bkz. kullanıcı isteği: "hangi ürünler olacak vs vs gibi bir çok detay
// olmalı" - koleksiyon vitrinindeki ürün sırasını değiştirme imkanı hiç
// yoktu. İki ürünün sortOrder'ı basitçe yer değiştirir (yukarı/aşağı taşı).
export async function moveCollectionProduct(collectionId: number, productId: number, direction: "up" | "down") {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.id, collectionId))
      .limit(1)
      .for("update");
    if (!collection) return false;

    const items = await tx
      .select({ id: collectionProducts.id, productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(eq(collectionProducts.collectionId, collectionId))
      .orderBy(asc(collectionProducts.sortOrder), asc(collectionProducts.id))
      .for("update");
    const index = items.findIndex((item) => item.productId === productId);
    if (index === -1) return false;
    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= items.length) return true;

    const reordered = [...items];
    [reordered[index], reordered[neighborIndex]] = [reordered[neighborIndex]!, reordered[index]!];
    for (let position = 0; position < reordered.length; position += 1) {
      await tx.update(collectionProducts).set({ sortOrder: position }).where(eq(collectionProducts.id, reordered[position]!.id));
    }
    return true;
  });
}
