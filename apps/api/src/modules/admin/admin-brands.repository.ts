import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { brands } from "../../db/schema/index";

export async function listAllBrands() {
  return db.select().from(brands).orderBy(asc(brands.name));
}

export async function createBrand(name: string, slug: string) {
  const [row] = await db.insert(brands).values({ name, slug }).returning();
  return row!;
}

export async function updateBrand(id: number, isActive: boolean) {
  const [row] = await db.update(brands).set({ isActive }).where(eq(brands.id, id)).returning();
  return row ?? null;
}

export async function deleteBrand(id: number) {
  const result = await db.delete(brands).where(eq(brands.id, id)).returning({ id: brands.id });
  return result.length > 0;
}

// bkz. denetim raporu: satıcı formundaki Marka datalist'i için - sadece
// aktif markalar önerilir.
export async function listActiveBrandNames(): Promise<string[]> {
  const rows = await db.select({ name: brands.name }).from(brands).where(eq(brands.isActive, true)).orderBy(asc(brands.name));
  return rows.map((r) => r.name);
}
