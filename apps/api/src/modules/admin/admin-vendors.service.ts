import { reindexVendorProducts } from "../catalog/search-index.service";
import { notifyVendorActivated } from "../notifications/vendor-activation-notification.service";
import { findVendorById } from "../vendors/vendor.repository";
import { deleteVendorIfNoProducts, updateVendorStatus } from "./admin-vendors.repository";

const ACTION_STATUS = {
  approve: "active",
  activate: "active",
  suspend: "suspended",
  ban: "banned",
} as const;

export class VendorNotFoundError extends Error {}
export class VendorHasProductsError extends Error {}
export class VendorProfileIncompleteError extends Error {}
export class VendorStatusChangedError extends Error {}

// bkz. kullanıcı isteği: "vergi/tckn no'su email'i telefon no'su adresi
// olmayan satıcılar satış yapamaz" - satıcı "active" duruma SADECE bu dört
// alan tamamsa geçebilir. Zaten "active" olan (bu kısıttan önce onaylanmış)
// satıcılar burada geriye dönük durdurulmaz - sadece yeni onay/aktivasyon
// anında uygulanır (bkz. satici panel dashboard'undaki tamamlama uyarısı).
async function assertVendorReadyToSell(vendorId: number) {
  const vendor = await findVendorById(vendorId);
  if (!vendor) throw new VendorNotFoundError();
  if (!vendor.taxId || !vendor.phone || !vendor.legalAddress || !vendor.emailVerifiedAt) {
    throw new VendorProfileIncompleteError();
  }
}

// Postgres tarafında satıcı durumu değiştiğinde ürünlerinin sitede
// görünürlüğünü ayrıca senkronize etmeye gerek yok - katalog sorguları
// (bkz. catalog.repository.ts) her zaman canlı olarak vendors.status='active'
// şartını arıyor. Ama Meilisearch denormalize bir kopya olduğundan
// (arama indeksindeki `visible` alanı) bunu elle güncellemek gerekiyor.
export async function applyVendorAction(vendorId: number, action: keyof typeof ACTION_STATUS) {
  const before = await findVendorById(vendorId);
  if (!before) throw new VendorNotFoundError();
  if (ACTION_STATUS[action] === "active") await assertVendorReadyToSell(vendorId);
  const updated = await updateVendorStatus(vendorId, ACTION_STATUS[action], action === "approve" ? "pending" : undefined);
  if (!updated) {
    if (action === "approve") throw new VendorStatusChangedError();
    throw new VendorNotFoundError();
  }
  if (action === "approve") await notifyVendorActivated(updated);
  reindexVendorProducts(vendorId).catch(() => {});
  return updated;
}

export async function removeVendor(vendorId: number) {
  const deleted = await deleteVendorIfNoProducts(vendorId);
  if (!deleted) throw new VendorHasProductsError();
}
