import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { pages, promoBanners, sliders } from "../../db/schema/index";

export async function findPublicPageBySlug(slug: string) {
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return row ?? null;
}

export async function listActiveSliders() {
  return db.select().from(sliders).where(eq(sliders.isActive, true)).orderBy(sliders.sortOrder);
}

export async function listActivePromoBanners() {
  return db.select().from(promoBanners).where(eq(promoBanners.isActive, true)).orderBy(promoBanners.sortOrder);
}
