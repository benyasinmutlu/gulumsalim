import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  campaigns,
  collectionProducts,
  collections,
  customerVendorMessages,
  discoverEvents,
  homepageSectionBanners,
  orderItems,
  orders,
  products,
  promoBannerClicks,
  promoBannerImages,
  promoBanners,
  vendorAdminMessages,
  vendorChannelCredentials,
  vendorComplaints,
  vendorEarnings,
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
export type DeleteVendorResult =
  | { status: "deleted"; mediaUrls: string[] }
  | { status: "not_found" }
  | { status: "has_business_history" };

export async function deleteVendorIfNoBusinessHistory(vendorId: number): Promise<DeleteVendorResult> {
  return db.transaction(async (tx) => {
    const [vendor] = await tx
      .select({ id: vendors.id, walletBalance: vendors.walletBalance, logo: vendors.logo, coverImage: vendors.coverImage })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1)
      .for("update");
    if (!vendor) return { status: "not_found" };

    const [[productRow], [orderRow], [earningRow], [payoutRow]] = await Promise.all([
      tx.select({ id: products.id }).from(products).where(eq(products.vendorId, vendorId)).limit(1),
      tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.vendorId, vendorId)).limit(1),
      tx.select({ id: vendorEarnings.id }).from(vendorEarnings).where(eq(vendorEarnings.vendorId, vendorId)).limit(1),
      tx.select({ id: vendorPayouts.id }).from(vendorPayouts).where(eq(vendorPayouts.vendorId, vendorId)).limit(1),
    ]);
    if (productRow || orderRow || earningRow || payoutRow || Number(vendor.walletBalance) !== 0) {
      return { status: "has_business_history" };
    }

    const campaignRows = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.scope, "vendor"), eq(campaigns.scopeId, vendorId)))
      .for("update");
    const campaignIds = campaignRows.map((row) => row.id);
    if (campaignIds.length > 0) {
      const [campaignOrder] = await tx.select({ id: orders.id }).from(orders).where(inArray(orders.campaignId, campaignIds)).limit(1);
      if (campaignOrder) return { status: "has_business_history" };
    }

    const collectionRows = await tx.select({ id: collections.id }).from(collections).where(eq(collections.vendorId, vendorId));
    const collectionIds = collectionRows.map((row) => row.id);
    if (collectionIds.length > 0) {
      await tx.delete(collectionProducts).where(inArray(collectionProducts.collectionId, collectionIds));
      await tx.delete(collections).where(eq(collections.vendorId, vendorId));
    }

    const bannerRows = await tx.select({ id: promoBanners.id, image: promoBanners.image }).from(promoBanners).where(eq(promoBanners.vendorId, vendorId));
    const bannerIds = bannerRows.map((row) => row.id);
    const bannerImageRows = bannerIds.length > 0
      ? await tx.select({ image: promoBannerImages.image }).from(promoBannerImages).where(inArray(promoBannerImages.bannerId, bannerIds))
      : [];
    if (bannerIds.length > 0) {
      await tx.delete(promoBannerClicks).where(inArray(promoBannerClicks.bannerId, bannerIds));
      await tx.delete(promoBannerImages).where(inArray(promoBannerImages.bannerId, bannerIds));
      await tx.delete(homepageSectionBanners).where(inArray(homepageSectionBanners.bannerId, bannerIds));
      await tx.delete(promoBanners).where(eq(promoBanners.vendorId, vendorId));
    }

    const slideRows = await tx.select({ image: vendorStoreSlides.image }).from(vendorStoreSlides).where(eq(vendorStoreSlides.vendorId, vendorId));
    const socialRows = await tx.select({ image: vendorSocialPosts.image }).from(vendorSocialPosts).where(eq(vendorSocialPosts.vendorId, vendorId));
    await tx.delete(vendorStoreSlides).where(eq(vendorStoreSlides.vendorId, vendorId));
    await tx.delete(vendorSocialPosts).where(eq(vendorSocialPosts.vendorId, vendorId));
    await tx.delete(vendorAdminMessages).where(eq(vendorAdminMessages.vendorId, vendorId));
    await tx.delete(customerVendorMessages).where(eq(customerVendorMessages.vendorId, vendorId));
    await tx.delete(vendorReviews).where(eq(vendorReviews.vendorId, vendorId));
    await tx.delete(vendorComplaints).where(eq(vendorComplaints.vendorId, vendorId));
    await tx.delete(vendorNotifications).where(eq(vendorNotifications.vendorId, vendorId));
    await tx.delete(vendorFollowers).where(eq(vendorFollowers.vendorId, vendorId));
    await tx.delete(vendorChannelCredentials).where(eq(vendorChannelCredentials.vendorId, vendorId));
    await tx.delete(discoverEvents).where(eq(discoverEvents.vendorId, vendorId));
    if (campaignIds.length > 0) await tx.delete(campaigns).where(inArray(campaigns.id, campaignIds));
    const result = await tx.delete(vendors).where(eq(vendors.id, vendorId)).returning({ id: vendors.id });
    if (result.length !== 1) throw new Error("Satıcı silinemedi");
    return {
      status: "deleted",
      mediaUrls: [
        vendor.logo,
        vendor.coverImage,
        ...slideRows.map((row) => row.image),
        ...socialRows.map((row) => row.image),
        ...bannerRows.map((row) => row.image),
        ...bannerImageRows.map((row) => row.image),
      ].filter((url): url is string => Boolean(url)),
    };
  });
}
