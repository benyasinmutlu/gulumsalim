import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { products, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

type VendorStatus = "pending" | "active" | "suspended" | "banned";

export async function listVendorsByStatus(status?: VendorStatus) {
  const base = db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      email: vendors.email,
      fullName: vendors.fullName,
      phone: vendors.phone,
      status: vendors.status,
      isVerified: vendors.isVerified,
      createdAt: vendors.createdAt,
      commissionRate: vendors.commissionRate,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)})`,
    })
    .from(vendors)
    .orderBy(desc(vendors.createdAt));

  if (status) return base.where(eq(vendors.status, status));
  return base;
}

export async function countVendorsByStatus() {
  const rows = await db.select({ status: vendors.status, count: sql<number>`COUNT(*)` }).from(vendors).groupBy(vendors.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
}

async function findVendorProductCount(vendorId: number) {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(products).where(eq(products.vendorId, vendorId));
  return Number(row?.count ?? 0);
}

export async function updateVendorStatus(vendorId: number, status: Exclude<VendorStatus, "pending">) {
  const [row] = await db
    .update(vendors)
    .set({ status })
    .where(eq(vendors.id, vendorId))
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

// Sadece ürünü olmayan satıcılar silinebilir - aksi halde satıcıya bağlı
// ürünler/siparişler referans bütünlüğünü bozardı. Ürünü olan bir satıcıyı
// kalıcı olarak kapatmak için "banned" durumu kullanılmalı.
export async function deleteVendorIfNoProducts(vendorId: number) {
  const count = await findVendorProductCount(vendorId);
  if (count > 0) return false;
  const result = await db.delete(vendors).where(eq(vendors.id, vendorId)).returning({ id: vendors.id });
  return result.length > 0;
}
