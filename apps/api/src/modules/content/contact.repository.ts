import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { contactMessages } from "../../db/schema/index";

export async function insertContactMessage(name: string, email: string, message: string) {
  const [row] = await db.insert(contactMessages).values({ name, email, message }).returning();
  return row!;
}

export async function listContactMessages() {
  return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
}

export async function markContactMessageRead(id: number) {
  const [row] = await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  return row ?? null;
}

export async function deleteContactMessage(id: number) {
  const result = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  return result.length > 0;
}
