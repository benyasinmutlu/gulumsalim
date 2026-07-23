import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorNotifications } from "../../db/schema/index";

export async function listVendorNotifications(vendorId: number) {
  return db
    .select()
    .from(vendorNotifications)
    .where(eq(vendorNotifications.vendorId, vendorId))
    .orderBy(desc(vendorNotifications.createdAt))
    .limit(100);
}

export async function countUnreadNotifications(vendorId: number) {
  const rows = await db
    .select({ id: vendorNotifications.id })
    .from(vendorNotifications)
    .where(and(eq(vendorNotifications.vendorId, vendorId), eq(vendorNotifications.isRead, false)));
  return rows.length;
}

export async function markNotificationRead(vendorId: number, id: number) {
  const [row] = await db
    .update(vendorNotifications)
    .set({ isRead: true })
    .where(and(eq(vendorNotifications.id, id), eq(vendorNotifications.vendorId, vendorId)))
    .returning({ id: vendorNotifications.id });
  return row ?? null;
}

export async function markAllNotificationsRead(vendorId: number) {
  await db
    .update(vendorNotifications)
    .set({ isRead: true })
    .where(and(eq(vendorNotifications.vendorId, vendorId), eq(vendorNotifications.isRead, false)));
}

// Sipariş/soru/admin mesajı gibi olaylarda çağrılan tek merkezi bildirim
// oluşturucu - diğer modüller (vendor-orders, questions, messaging) bunu
// import edip kullanır.
export async function createNotification(vendorId: number, type: string, title: string, message?: string, link?: string) {
  await db.insert(vendorNotifications).values({ vendorId, type, title, message, link });
}
