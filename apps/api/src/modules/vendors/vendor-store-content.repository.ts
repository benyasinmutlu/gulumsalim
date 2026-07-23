import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorSocialPosts, vendorStoreSlides } from "../../db/schema/index";

export async function listVendorStoreSlides(vendorId: number) {
  return db.select().from(vendorStoreSlides).where(eq(vendorStoreSlides.vendorId, vendorId)).orderBy(asc(vendorStoreSlides.sortOrder));
}

export async function insertVendorStoreSlide(vendorId: number, data: { image: string; title?: string; subtitle?: string; buttonText?: string; linkUrl?: string }) {
  const existing = await listVendorStoreSlides(vendorId);
  const [row] = await db.insert(vendorStoreSlides).values({ vendorId, ...data, sortOrder: existing.length }).returning();
  if (!row) throw new Error("Slayt eklenemedi");
  return row;
}

export async function deleteVendorStoreSlide(vendorId: number, id: number) {
  const result = await db.delete(vendorStoreSlides).where(and(eq(vendorStoreSlides.id, id), eq(vendorStoreSlides.vendorId, vendorId))).returning({ id: vendorStoreSlides.id });
  return result.length > 0;
}

export async function listVendorSocialPosts(vendorId: number) {
  return db.select().from(vendorSocialPosts).where(eq(vendorSocialPosts.vendorId, vendorId)).orderBy(asc(vendorSocialPosts.sortOrder));
}

export async function insertVendorSocialPost(vendorId: number, data: { platform: string; postUrl: string; image?: string; caption?: string }) {
  const existing = await listVendorSocialPosts(vendorId);
  const [row] = await db.insert(vendorSocialPosts).values({ vendorId, ...data, sortOrder: existing.length }).returning();
  if (!row) throw new Error("Gönderi eklenemedi");
  return row;
}

export async function deleteVendorSocialPost(vendorId: number, id: number) {
  const result = await db.delete(vendorSocialPosts).where(and(eq(vendorSocialPosts.id, id), eq(vendorSocialPosts.vendorId, vendorId))).returning({ id: vendorSocialPosts.id });
  return result.length > 0;
}
