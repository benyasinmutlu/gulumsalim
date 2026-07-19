import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vendors } from "../../db/schema/index";

export async function findVendorByEmail(email: string) {
  const [row] = await db.select().from(vendors).where(eq(vendors.email, email)).limit(1);
  return row ?? null;
}

export async function findVendorBySlug(slug: string) {
  const [row] = await db.select().from(vendors).where(eq(vendors.storeSlug, slug)).limit(1);
  return row ?? null;
}

export async function findVendorById(id: number) {
  const [row] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return row ?? null;
}

export async function createVendor(data: {
  storeName: string;
  storeSlug: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
}) {
  const [row] = await db.insert(vendors).values(data).returning();
  if (!row) throw new Error("Satıcı oluşturulamadı");
  return row;
}
