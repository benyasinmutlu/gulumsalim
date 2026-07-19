import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { promoBanners, sliders } from "../../db/schema/index";

export async function listAllSliders() {
  return db.select().from(sliders).orderBy(sliders.sortOrder);
}

export async function insertSlider(data: { image: string; linkUrl?: string; sortOrder: number }) {
  const [row] = await db.insert(sliders).values(data).returning();
  if (!row) throw new Error("Slider oluşturulamadı");
  return row;
}

export async function updateSlider(
  id: number,
  data: Partial<{ linkUrl: string; sortOrder: number; isActive: boolean }>,
) {
  const [row] = await db.update(sliders).set(data).where(eq(sliders.id, id)).returning();
  return row ?? null;
}

export async function deleteSlider(id: number) {
  const result = await db.delete(sliders).where(eq(sliders.id, id)).returning({ id: sliders.id });
  return result.length > 0;
}

export async function listAllPromoBanners() {
  return db.select().from(promoBanners).orderBy(promoBanners.sortOrder);
}

export async function insertPromoBanner(data: { title: string; image: string; linkUrl?: string; sortOrder: number }) {
  const [row] = await db.insert(promoBanners).values(data).returning();
  if (!row) throw new Error("Banner oluşturulamadı");
  return row;
}

export async function updatePromoBanner(
  id: number,
  data: Partial<{ title: string; linkUrl: string; sortOrder: number; isActive: boolean }>,
) {
  const [row] = await db.update(promoBanners).set(data).where(eq(promoBanners.id, id)).returning();
  return row ?? null;
}

export async function deletePromoBanner(id: number) {
  const result = await db.delete(promoBanners).where(eq(promoBanners.id, id)).returning({ id: promoBanners.id });
  return result.length > 0;
}
