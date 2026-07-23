import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { homepageCollectionProducts, homepageCollections, products } from "../../db/schema/index";

export async function listAllHomepageCollections() {
  return db.select().from(homepageCollections).orderBy(homepageCollections.sortOrder);
}

interface CollectionInput {
  title: string;
  subtitle?: string;
  textColor?: string;
  linkType?: string;
  linkValue?: string;
  sortOrder: number;
}

export async function insertHomepageCollection(data: CollectionInput) {
  const [row] = await db.insert(homepageCollections).values(data).returning();
  if (!row) throw new Error("Koleksiyon oluşturulamadı");
  return row;
}

export async function updateHomepageCollection(
  id: number,
  data: Partial<CollectionInput & { isActive: boolean }>,
) {
  const [row] = await db.update(homepageCollections).set(data).where(eq(homepageCollections.id, id)).returning();
  return row ?? null;
}

export async function deleteHomepageCollection(id: number) {
  await db.delete(homepageCollectionProducts).where(eq(homepageCollectionProducts.homepageCollectionId, id));
  const result = await db.delete(homepageCollections).where(eq(homepageCollections.id, id)).returning({ id: homepageCollections.id });
  return result.length > 0;
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

export async function addProductToCollection(collectionId: number, productId: number, sortOrder: number) {
  const [row] = await db
    .insert(homepageCollectionProducts)
    .values({ homepageCollectionId: collectionId, productId, sortOrder })
    .onConflictDoNothing({ target: [homepageCollectionProducts.homepageCollectionId, homepageCollectionProducts.productId] })
    .returning();
  return row ?? null;
}

export async function removeProductFromCollection(collectionId: number, productId: number) {
  await db
    .delete(homepageCollectionProducts)
    .where(
      and(
        eq(homepageCollectionProducts.homepageCollectionId, collectionId),
        eq(homepageCollectionProducts.productId, productId),
      ),
    );
}
