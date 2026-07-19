import { eq } from "drizzle-orm";
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
}) {
  const [row] = await db.insert(customers).values(data).returning();
  if (!row) throw new Error("Müşteri oluşturulamadı");
  return row;
}
