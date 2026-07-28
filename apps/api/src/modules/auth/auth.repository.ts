import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/client";
import { customers } from "../../db/schema/index";

export async function findCustomerByEmail(email: string) {
  const [row] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  return row ?? null;
}

export async function findCustomerById(id: number) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row ?? null;
}

export async function createCustomer(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  membershipConsentAt?: Date;
  marketingConsentAt?: Date;
  analyticsConsentAt?: Date;
}) {
  const [row] = await db.insert(customers).values(data).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}

export async function createGuestCustomer(data: { email: string; passwordHash: string; fullName: string; phone?: string }) {
  const [row] = await db.insert(customers).values({ ...data, isGuest: true }).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}

export async function updateGuestCustomerContact(id: number, data: { fullName: string; phone?: string }) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Müşteri bulunamadı");
  return row;
}

export async function updateCustomerProfile(
  id: number,
  data: Partial<{ fullName: string; phone: string; age: number; heightCm: number; weightKg: number; passwordHash: string }>,
) {
  const [row] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
  if (!row) throw new Error("Profil güncellenemedi");
  return row;
}

// "Şifremi Unuttum" akışı - bkz. auth.service.ts requestPasswordReset.
export async function setCustomerResetToken(id: number, tokenHash: string, expiresAt: Date) {
  await db.update(customers).set({ passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt }).where(eq(customers.id, id));
}

export async function findCustomerByValidResetToken(tokenHash: string) {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.passwordResetTokenHash, tokenHash), gt(customers.passwordResetExpiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function clearCustomerResetToken(id: number) {
  await db.update(customers).set({ passwordResetTokenHash: null, passwordResetExpiresAt: null }).where(eq(customers.id, id));
}
