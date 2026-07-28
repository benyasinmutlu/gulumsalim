import { reindexVendorProducts } from "../catalog/search-index.service";
import { deleteVendorIfNoProducts, updateVendorStatus } from "./admin-vendors.repository";

const ACTION_STATUS = {
  approve: "active",
  activate: "active",
  suspend: "suspended",
  ban: "banned",
} as const;

export class VendorNotFoundError extends Error {}
export class VendorHasProductsError extends Error {}

// Postgres tarafında satıcı durumu değiştiğinde ürünlerinin sitede
// görünürlüğünü ayrıca senkronize etmeye gerek yok - katalog sorguları
// (bkz. catalog.repository.ts) her zaman canlı olarak vendors.status='active'
// şartını arıyor. Ama Meilisearch denormalize bir kopya olduğundan
// (arama indeksindeki `visible` alanı) bunu elle güncellemek gerekiyor.
export async function applyVendorAction(vendorId: number, action: keyof typeof ACTION_STATUS) {
  const updated = await updateVendorStatus(vendorId, ACTION_STATUS[action]);
  if (!updated) throw new VendorNotFoundError();
  reindexVendorProducts(vendorId).catch(() => {});
  return updated;
}

export async function removeVendor(vendorId: number) {
  const deleted = await deleteVendorIfNoProducts(vendorId);
  if (!deleted) throw new VendorHasProductsError();
}
