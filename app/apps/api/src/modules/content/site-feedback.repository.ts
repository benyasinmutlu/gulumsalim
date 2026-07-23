import { desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { siteFeedback } from "../../db/schema/index";

export async function insertSiteFeedback(data: {
  customerId?: number;
  rating?: number;
  category?: string;
  message: string;
  pageUrl?: string;
}) {
  const [row] = await db.insert(siteFeedback).values(data).returning();
  if (!row) throw new Error("Geri bildirim kaydedilemedi");
  return row;
}

export async function listSiteFeedback() {
  return db.select().from(siteFeedback).orderBy(desc(siteFeedback.createdAt));
}

export async function markSiteFeedbackRead(id: number) {
  const [row] = await db.update(siteFeedback).set({ isRead: true }).where(eq(siteFeedback.id, id)).returning({ id: siteFeedback.id });
  return row ?? null;
}

export async function countUnreadSiteFeedback() {
  const rows = await db.select({ id: siteFeedback.id }).from(siteFeedback).where(eq(siteFeedback.isRead, false));
  return rows.length;
}
