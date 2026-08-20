import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  customerVendorMessages,
  discoverEvents,
  orderItems,
  products,
  promoBanners,
  vendorAdminMessages,
  vendorChannelCredentials,
  vendorComplaints,
  vendorFollowers,
  vendorNotifications,
  vendorPayouts,
  vendorReviews,
  vendorSocialPosts,
  vendorStoreSlides,
  vendors,
} from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

type VendorStatus = "pending" | "active" | "suspended" | "banned" | "closed";
type VendorType = "business" | "individual";

// bkz. kullanıcı isteği (2026-08-02): "bireysel satıcıları admin panelinden
// ayrı yönetelim ... ürünleri onaylandıktan sonra listelerken belli olsun" -
// pendingProductCount, hangi bireysel satıcının onay bekleyen ürünü olduğunu
// admin listede tek bakışta görebilsin diye eklendi (bkz. products.status
// 'pending' - sadece bireysel satıcı akışında oluşur).
export async function listVendorsByStatus(status?: VendorStatus, vendorType?: VendorType) {
  const base = db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      email: vendors.email,
      fullName: vendors.fullName,
      phone: vendors.phone,
      status: vendors.status,
      vendorType: vendors.vendorType,
      isVerified: vendors.isVerified,
      createdAt: vendors.createdAt,
      commissionRate: vendors.commissionRate,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)})`,
      pendingProductCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'pending')`,
    })
    .from(vendors)
    .orderBy(desc(vendors.createdAt));

  const conditions = [];
  if (status) conditions.push(eq(vendors.status, status));
  if (vendorType) conditions.push(eq(vendors.vendorType, vendorType));
  if (conditions.length > 0) return base.where(and(...conditions));
  return base;
}

export async function countVendorsByStatus() {
  const rows = await db.select({ status: vendors.status, count: sql<number>`COUNT(*)` }).from(vendors).groupBy(vendors.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

export async function countVendorsByType() {
  const rows = await db.select({ vendorType: vendors.vendorType, count: sql<number>`COUNT(*)` }).from(vendors).groupBy(vendors.vendorType);
  return Object.fromEntries(rows.map((r) => [r.vendorType, Number(r.count)]));
}

async function findVendorProductCount(vendorId: number) {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.vendorId, vendorId));
  return Number(row?.count ?? 0);
}

export async function updateVendorStatus(
  vendorId: number,
  status: Exclude<VendorStatus, "pending">,
  expectedStatus?: VendorStatus,
) {
  const [row] = await db
    .update(vendors)
    .set({ status })
    .where(expectedStatus ? and(eq(vendors.id, vendorId), eq(vendors.status, expectedStatus)) : eq(vendors.id, vendorId))
    .returning({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      email: vendors.email,
      fullName: vendors.fullName,
      phone: vendors.phone,
      status: vendors.status,
      createdAt: vendors.createdAt,
    });
  return row ?? null;
}

// bkz. kullanıcı isteği: "her satıcıya admin üzerinden farklı komisyon
// oranları belirlenebilecek" - null, platform varsayılanına dönmek
// (vendors.commissionRate sütununu NULL yapmak) için kullanılır.
export async function updateVendorCommission(vendorId: number, commissionRate: number | null) {
  const [row] = await db
    .update(vendors)
    .set({ commissionRate: commissionRate === null ? null : commissionRate.toFixed(2) })
    .where(eq(vendors.id, vendorId))
    .returning({ id: vendors.id, commissionRate: vendors.commissionRate });
  return row ?? null;
}

// Sadece ürünü (ve dolayısıyla siparişi) olmayan satıcılar silinebilir -
// aksi halde referans bütünlüğü bozulurdu. Ürünü olan bir satıcıyı kalıcı
// olarak kapatmak için "banned" durumu kullanılmalı. Ürünü hiç olmamış bir
// satıcının mağaza profiliyle ilgili TÜM bağımlı satırları (slider, sosyal
// gönderi, admin/müşteri mesajları, değerlendirme, şikayet, bildirim, ödeme
// talebi, takipçi, banner, kanal kimlik bilgisi) tek transaction'da
// temizlenip asıl satır silinir.
export async function deleteVendorIfNoProducts(vendorId: number) {
  const count = await findVendorProductCount(vendorId);
  if (count > 0) return false;
  const [orderRow] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.vendorId, vendorId)).limit(1);
  if (orderRow) return false;

  return db.transaction(async (tx) => {
    await tx.delete(vendorStoreSlides).where(eq(vendorStoreSlides.vendorId, vendorId));
    await tx.delete(vendorSocialPosts).where(eq(vendorSocialPosts.vendorId, vendorId));
    await tx.delete(vendorAdminMessages).where(eq(vendorAdminMessages.vendorId, vendorId));
    await tx.delete(customerVendorMessages).where(eq(customerVendorMessages.vendorId, vendorId));
    await tx.delete(vendorReviews).where(eq(vendorReviews.vendorId, vendorId));
    await tx.delete(vendorComplaints).where(eq(vendorComplaints.vendorId, vendorId));
    await tx.delete(vendorNotifications).where(eq(vendorNotifications.vendorId, vendorId));
    await tx.delete(vendorPayouts).where(eq(vendorPayouts.vendorId, vendorId));
    await tx.delete(vendorFollowers).where(eq(vendorFollowers.vendorId, vendorId));
    await tx.delete(promoBanners).where(eq(promoBanners.vendorId, vendorId));
    await tx.delete(vendorChannelCredentials).where(eq(vendorChannelCredentials.vendorId, vendorId));
    await tx.delete(discoverEvents).where(eq(discoverEvents.vendorId, vendorId));
    const result = await tx.delete(vendors).where(eq(vendors.id, vendorId)).returning({ id: vendors.id });
    return result.length > 0;
  });
}
