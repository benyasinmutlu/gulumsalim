import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { vendorAdminMessages, vendors } from "../../db/schema/index";
import { createNotification } from "../notifications/notifications.repository";

// Admin tarafı: her satıcı için son mesajı ve okunmamış (satıcıdan gelen,
// admin'in henüz okumadığı) mesaj sayısını listeler - gelen kutusu görünümü.
// Tek bir GROUP BY sorgusu - birden fazla bağımlı (correlated) alt sorgu
// yerine, daha güvenilir/basit.
export async function listConversationsForAdmin() {
  const rows = await db
    .select({
      vendorId: vendorAdminMessages.vendorId,
      vendorStoreName: vendors.storeName,
      vendorLogo: vendors.logo,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${vendorAdminMessages.sender} = 'vendor' AND ${vendorAdminMessages.isRead} = false)`,
      lastMessage: sql<string>`(array_agg(${vendorAdminMessages.message} ORDER BY ${vendorAdminMessages.createdAt} DESC))[1]`,
      lastSender: sql<string>`(array_agg(${vendorAdminMessages.sender} ORDER BY ${vendorAdminMessages.createdAt} DESC))[1]`,
      lastMessageAt: sql<string>`MAX(${vendorAdminMessages.createdAt})`,
    })
    .from(vendorAdminMessages)
    .innerJoin(vendors, eq(vendorAdminMessages.vendorId, vendors.id))
    .groupBy(vendorAdminMessages.vendorId, vendors.storeName, vendors.logo)
    .orderBy(desc(sql`MAX(${vendorAdminMessages.createdAt})`));

  return rows;
}

// admin/vendor-messages.php'deki "Konuşmayı Sil" işleminin karşılığı -
// tüm geçmişi kalıcı olarak siler (geri alınamaz, bkz. onay diyaloğu).
export async function deleteThread(vendorId: number) {
  await db.delete(vendorAdminMessages).where(eq(vendorAdminMessages.vendorId, vendorId));
}

export async function listThread(vendorId: number) {
  return db
    .select()
    .from(vendorAdminMessages)
    .where(eq(vendorAdminMessages.vendorId, vendorId))
    .orderBy(asc(vendorAdminMessages.createdAt));
}

export async function sendMessage(vendorId: number, sender: "admin" | "vendor", message: string) {
  const [row] = await db.insert(vendorAdminMessages).values({ vendorId, sender, message }).returning();
  if (sender === "admin") {
    await createNotification(vendorId, "admin_message", "Yönetimden Yeni Mesaj", message.slice(0, 120), "/satici/panel/mesajlar");
  }
  return row!;
}

// Bir taraf mesajları okuduğunda, KARŞI taraftan gelen okunmamış mesajları
// okundu olarak işaretler (admin panelini açan admin, satıcının mesajlarını
// okumuş sayılır - ve tam tersi).
export async function markThreadRead(vendorId: number, readerSender: "admin" | "vendor") {
  const otherSender = readerSender === "admin" ? "vendor" : "admin";
  await db
    .update(vendorAdminMessages)
    .set({ isRead: true })
    .where(and(eq(vendorAdminMessages.vendorId, vendorId), eq(vendorAdminMessages.sender, otherSender), ne(vendorAdminMessages.isRead, true)));
}

export async function countUnreadForVendor(vendorId: number) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(vendorAdminMessages)
    .where(and(eq(vendorAdminMessages.vendorId, vendorId), eq(vendorAdminMessages.sender, "admin"), eq(vendorAdminMessages.isRead, false)));
  return Number(row?.count ?? 0);
}
