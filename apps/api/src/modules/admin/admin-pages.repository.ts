import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { pages } from "../../db/schema/index";

export async function listPages() {
  return db.select().from(pages).orderBy(desc(pages.updatedAt));
}

export async function findPageBySlug(slug: string) {
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return row ?? null;
}

export async function insertPage(data: { slug: string; title: string; content: string }) {
  const [row] = await db.insert(pages).values(data).returning();
  if (!row) throw new Error("Sayfa oluşturulamadı");
  return row;
}

export async function updatePage(id: number, data: Partial<{ slug: string; title: string; content: string }>) {
  const [row] = await db
    .update(pages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(pages.id, id))
    .returning();
  return row ?? null;
}

export async function deletePage(id: number) {
  const result = await db.delete(pages).where(eq(pages.id, id)).returning({ id: pages.id });
  return result.length > 0;
}
