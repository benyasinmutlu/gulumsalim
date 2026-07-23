import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, customerVendorMessages, vendors } from "../../db/schema/index";
import { createNotification } from "../notifications/notifications.repository";

// vendor/messages.php "Müşteri Mesajları" sekmesinin karşılığı -
// messaging.repository.ts'deki admin<->satıcı desenin aynısı, tek fark
// thread anahtarının (vendorId, customerId) çifti olması.

export async function listConversationsForVendor(vendorId: number) {
  return db
    .select({
      customerId: customerVendorMessages.customerId,
      customerName: customers.fullName,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${customerVendorMessages.sender} = 'customer' AND ${customerVendorMessages.isRead} = false)`,
      lastMessage: sql<string>`(array_agg(${customerVendorMessages.message} ORDER BY ${customerVendorMessages.createdAt} DESC))[1]`,
      lastMessageAt: sql<string>`MAX(${customerVendorMessages.createdAt})`,
    })
    .from(customerVendorMessages)
    .innerJoin(customers, eq(customerVendorMessages.customerId, customers.id))
    .where(eq(customerVendorMessages.vendorId, vendorId))
    .groupBy(customerVendorMessages.customerId, customers.fullName)
    .orderBy(desc(sql`MAX(${customerVendorMessages.createdAt})`));
}

export async function listConversationsForCustomer(customerId: number) {
  return db
    .select({
      vendorId: customerVendorMessages.vendorId,
      vendorStoreName: vendors.storeName,
      vendorStoreSlug: vendors.storeSlug,
      vendorLogo: vendors.logo,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${customerVendorMessages.sender} = 'vendor' AND ${customerVendorMessages.isRead} = false)`,
      lastMessage: sql<string>`(array_agg(${customerVendorMessages.message} ORDER BY ${customerVendorMessages.createdAt} DESC))[1]`,
      lastMessageAt: sql<string>`MAX(${customerVendorMessages.createdAt})`,
    })
    .from(customerVendorMessages)
    .innerJoin(vendors, eq(customerVendorMessages.vendorId, vendors.id))
    .where(eq(customerVendorMessages.customerId, customerId))
    .groupBy(customerVendorMessages.vendorId, vendors.storeName, vendors.storeSlug, vendors.logo)
    .orderBy(desc(sql`MAX(${customerVendorMessages.createdAt})`));
}

export async function listThread(vendorId: number, customerId: number) {
  return db
    .select()
    .from(customerVendorMessages)
    .where(and(eq(customerVendorMessages.vendorId, vendorId), eq(customerVendorMessages.customerId, customerId)))
    .orderBy(asc(customerVendorMessages.createdAt));
}

export async function sendMessage(vendorId: number, customerId: number, sender: "customer" | "vendor", message: string) {
  const [row] = await db.insert(customerVendorMessages).values({ vendorId, customerId, sender, message }).returning();
  if (sender === "customer") {
    await createNotification(vendorId, "customer_message", "Müşteriden Yeni Mesaj", message.slice(0, 120), "/satici/panel/mesajlar");
  }
  return row!;
}

export async function markThreadRead(vendorId: number, customerId: number, readerSender: "customer" | "vendor") {
  const otherSender = readerSender === "customer" ? "vendor" : "customer";
  await db
    .update(customerVendorMessages)
    .set({ isRead: true })
    .where(
      and(
        eq(customerVendorMessages.vendorId, vendorId),
        eq(customerVendorMessages.customerId, customerId),
        eq(customerVendorMessages.sender, otherSender),
        ne(customerVendorMessages.isRead, true),
      ),
    );
}

export async function countUnreadCustomerMessagesForVendor(vendorId: number) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(customerVendorMessages)
    .where(and(eq(customerVendorMessages.vendorId, vendorId), eq(customerVendorMessages.sender, "customer"), eq(customerVendorMessages.isRead, false)));
  return Number(row?.count ?? 0);
}
