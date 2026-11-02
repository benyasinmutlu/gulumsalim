import { and, eq, max, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { homepageCollectionProducts, homepageCollections, products } from "../../db/schema/index";

export async function listAllHomepageCollections() {
  return db.select().from(homepageCollections).orderBy(homepageCollections.sortOrder);
}

interface CollectionInput {
  title: string;
  subtitle?: string | null;
  textColor?: string | null;
  linkType?: string | null;
  linkValue?: string | null;
  sortOrder?: number;
}

export async function insertHomepageCollection(data: CollectionInput) {
  return db.transaction(async (tx) => {
    // Tüm adminler aynı anda koleksiyon eklese de iki kayda aynı sıra verilmez.
    await tx.execute(sql`select pg_advisory_xact_lock(730001)`);
    const [last] = await tx.select({ value: max(homepageCollections.sortOrder) }).from(homepageCollections);
    const [row] = await tx
      .insert(homepageCollections)
      .values({ ...data, sortOrder: data.sortOrder ?? (last?.value ?? -1) + 1 })
      .returning();
    if (!row) throw new Error("Koleksiyon oluşturulamadı");
    return row;
  });
}

export async function updateHomepageCollection(
  id: number,
  data: Partial<CollectionInput & { isActive: boolean }>,
) {
  const [row] = await db.update(homepageCollections).set(data).where(eq(homepageCollections.id, id)).returning();
  return row ?? null;
}

export async function deleteHomepageCollection(id: number) {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: homepageCollections.id })
      .from(homepageCollections)
      .where(eq(homepageCollections.id, id))
      .limit(1)
      .for("update");
    if (!owned) return false;
    await tx.delete(homepageCollectionProducts).where(eq(homepageCollectionProducts.homepageCollectionId, id));
    const result = await tx.delete(homepageCollections).where(eq(homepageCollections.id, id)).returning({ id: homepageCollections.id });
    return result.length > 0;
  });
}

export async function homepageCollectionExists(id: number) {
  const [row] = await db.select({ id: homepageCollections.id }).from(homepageCollections).where(eq(homepageCollections.id, id)).limit(1);
  return Boolean(row);
}

export async function listCollectionProducts(collectionId: number) {
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePrice: products.basePrice,
      sortOrder: homepageCollectionProducts.sortOrder,
      membershipId: homepageCollectionProducts.id,
    })
    .from(homepageCollectionProducts)
    .innerJoin(products, eq(homepageCollectionProducts.productId, products.id))
    .where(eq(homepageCollectionProducts.homepageCollectionId, collectionId))
    .orderBy(homepageCollectionProducts.sortOrder);
}

export async function addProductToCollection(collectionId: number, productId: number) {
  return db.transaction(async (tx) => {
    const [collection] = await tx
      .select({ id: homepageCollections.id })
      .from(homepageCollections)
      .where(eq(homepageCollections.id, collectionId))
      .limit(1)
      .for("update");
    if (!collection) return { status: "collection_not_found" as const };

    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return { status: "product_not_found" as const };

    const [last] = await tx
      .select({ value: max(homepageCollectionProducts.sortOrder) })
      .from(homepageCollectionProducts)
      .where(eq(homepageCollectionProducts.homepageCollectionId, collectionId));
    const [row] = await tx
      .insert(homepageCollectionProducts)
      .values({ homepageCollectionId: collectionId, productId, sortOrder: (last?.value ?? -1) + 1 })
      .onConflictDoNothing({ target: [homepageCollectionProducts.homepageCollectionId, homepageCollectionProducts.productId] })
      .returning();
    return row ? { status: "added" as const, row } : { status: "duplicate" as const };
  });
}

export async function removeProductFromCollection(collectionId: number, productId: number) {
  const rows = await db
    .delete(homepageCollectionProducts)
    .where(
      and(
        eq(homepageCollectionProducts.homepageCollectionId, collectionId),
        eq(homepageCollectionProducts.productId, productId),
      ),
    )
    .returning({ id: homepageCollectionProducts.id });
  return rows.length > 0;
}
