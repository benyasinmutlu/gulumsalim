import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { promoBanners, sliders } from "../../db/schema/index";

export async function listAllSliders() {
  return db.select().from(sliders).orderBy(sliders.sortOrder);
}

interface SliderInput {
  image: string;
  linkUrl?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  textColor?: string;
  textPosition?: string;
  sortOrder: number;
}

export async function insertSlider(data: SliderInput) {
  const [row] = await db.insert(sliders).values(data).returning();
  if (!row) throw new Error("Slider oluşturulamadı");
  return row;
}

export async function updateSlider(
  id: number,
  data: Partial<
    Pick<SliderInput, "linkUrl" | "title" | "subtitle" | "buttonText" | "textColor" | "textPosition" | "sortOrder"> & {
      isActive: boolean;
    }
  >,
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

interface PromoBannerInput {
  title: string;
  image: string;
  linkUrl?: string;
  subtitle?: string;
  buttonText?: string;
  textColor?: string;
  rotateSeconds?: number;
  sortOrder: number;
}

export async function insertPromoBanner(data: PromoBannerInput) {
  const [row] = await db.insert(promoBanners).values(data).returning();
  if (!row) throw new Error("Banner oluşturulamadı");
  return row;
}

export async function updatePromoBanner(
  id: number,
  data: Partial<
    Pick<PromoBannerInput, "title" | "linkUrl" | "subtitle" | "buttonText" | "textColor" | "rotateSeconds" | "sortOrder"> & {
      isActive: boolean;
    }
  >,
) {
  const [row] = await db.update(promoBanners).set(data).where(eq(promoBanners.id, id)).returning();
  return row ?? null;
}

export async function deletePromoBanner(id: number) {
  const result = await db.delete(promoBanners).where(eq(promoBanners.id, id)).returning({ id: promoBanners.id });
  return result.length > 0;
}

// gulumsalim.com'daki admin/promo-banners.php'nin onay/red işlemlerinin
// karşılığı - sadece satıcının gönderdiği bannerlar için anlamlı, admin'in
// kendi eklediği bannerlar zaten 'approved' olarak başlıyor.
export async function approvePromoBanner(id: number) {
  const [row] = await db
    .update(promoBanners)
    .set({ status: "approved", rejectionNote: null })
    .where(eq(promoBanners.id, id))
    .returning();
  return row ?? null;
}

export async function rejectPromoBanner(id: number, note?: string) {
  const [row] = await db
    .update(promoBanners)
    .set({ status: "rejected", rejectionNote: note ?? null })
    .where(eq(promoBanners.id, id))
    .returning();
  return row ?? null;
}
