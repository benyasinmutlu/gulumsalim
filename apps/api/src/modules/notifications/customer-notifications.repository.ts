import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customerNotifications } from "../../db/schema/index";

export async function listCustomerNotifications(customerId: number) {
  return db
    .select()
    .from(customerNotifications)
    .where(eq(customerNotifications.customerId, customerId))
    .orderBy(desc(customerNotifications.createdAt))
    .limit(100);
}

export async function countUnreadCustomerNotifications(customerId: number) {
  const rows = await db
    .select({ id: customerNotifications.id })
    .from(customerNotifications)
    .where(and(eq(customerNotifications.customerId, customerId), eq(customerNotifications.isRead, false)));
  return rows.length;
}

export async function markCustomerNotificationRead(customerId: number, id: number) {
  const [row] = await db
    .update(customerNotifications)
    .set({ isRead: true })
    .where(and(eq(customerNotifications.id, id), eq(customerNotifications.customerId, customerId)))
    .returning({ id: customerNotifications.id });
  return row ?? null;
}

export async function markAllCustomerNotificationsRead(customerId: number) {
  await db
    .update(customerNotifications)
    .set({ isRead: true })
    .where(and(eq(customerNotifications.customerId, customerId), eq(customerNotifications.isRead, false)));
}

// Sipariş kargoya verildi/teslim edildi, iade karar bilgisi gibi olaylarda
// çağrılan merkezi bildirim oluşturucu - vendor-orders.service.ts ve
// vendor-orders.repository.ts (iade karar) bunu import eder.
export async function createCustomerNotification(customerId: number, type: string, title: string, message?: string, link?: string) {
  await db.insert(customerNotifications).values({ customerId, type, title, message, link });
}
