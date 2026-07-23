import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { homepageSections, orderItems, orders, products, vendors } from "../../db/schema/index";

export async function listActiveSections() {
  return db
    .select()
    .from(homepageSections)
    .where(eq(homepageSections.isActive, true))
    .orderBy(homepageSections.sortOrder);
}

export async function listAllSections() {
  return db.select().from(homepageSections).orderBy(homepageSections.sortOrder);
}

export async function findSectionById(id: number) {
  const [row] = await db.select().from(homepageSections).where(eq(homepageSections.id, id)).limit(1);
  return row ?? null;
}

export async function insertSection(data: {
  title: string;
  algoType: (typeof homepageSections.$inferInsert)["algoType"];
  config: Record<string, unknown>;
  sortOrder: number;
}) {
  const [row] = await db.insert(homepageSections).values(data).returning();
  if (!row) throw new Error("Bölüm oluşturulamadı");
  return row;
}

export async function updateSection(
  id: number,
  data: Partial<{
    title: string;
    algoType: (typeof homepageSections.$inferInsert)["algoType"];
    config: Record<string, unknown>;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const [row] = await db.update(homepageSections).set(data).where(eq(homepageSections.id, id)).returning();
  return row ?? null;
}

export async function deleteSection(id: number) {
  const result = await db.delete(homepageSections).where(eq(homepageSections.id, id)).returning({ id: homepageSections.id });
  return result.length > 0;
}

// "En çok satan" hesaplaması: order_items.quantity toplamı, sadece ödemesi
// tamamlanmış siparişlerden. weekly_best için orders.createdAt son 7 günle
// sınırlanır, best_sellers için sınırsız (tüm zamanlar).
export async function computeBestSellingProductIds(limit: number, sinceDays?: number): Promise<number[]> {
  const conditions = [eq(orders.paymentStatus, "paid")];
  if (sinceDays !== undefined) {
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(orders.createdAt, cutoff));
  }

  const rows = await db
    .select({ productId: orderItems.productId, totalQty: sql<number>`SUM(${orderItems.quantity})`.as("total_qty") })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`total_qty`))
    .limit(limit);

  return rows.map((r) => r.productId);
}

// products tablosuna doğrudan erişim gereken (basit) yardımcılar - diğer
// modüllerin repository'lerini gereksiz yere çapraz import etmemek için
// burada tutuluyor.
export async function findNewArrivalProductIds(limit: number): Promise<number[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .where(and(eq(products.status, "active"), eq(vendors.status, "active")))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}
