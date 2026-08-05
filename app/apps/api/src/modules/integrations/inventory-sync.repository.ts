import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { channelListings, products, productVariants, stockSyncOutbox } from "../../db/schema/index";
import type { SalesChannel } from "./inventory-sync";

// ---------- Kanal listing (ürün ↔ kanal eşleme) ----------

export interface NewChannelListing {
  channel: SalesChannel;
  productId: number;
  variantId?: number | null;
  externalBarcode: string;
}

export async function insertChannelListing(data: NewChannelListing) {
  const [row] = await db
    .insert(channelListings)
    .values({
      channel: data.channel,
      productId: data.productId,
      variantId: data.variantId ?? null,
      externalBarcode: data.externalBarcode,
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

// Bir satıcının tüm kanal listing'leri (ürün üzerinden vendor scope).
export async function listVendorChannelListings(vendorId: number) {
  return db
    .select({
      id: channelListings.id,
      channel: channelListings.channel,
      productId: channelListings.productId,
      variantId: channelListings.variantId,
      externalBarcode: channelListings.externalBarcode,
      enabled: channelListings.enabled,
      lastSyncedStock: channelListings.lastSyncedStock,
      lastSyncedAt: channelListings.lastSyncedAt,
      syncStatus: channelListings.syncStatus,
      syncError: channelListings.syncError,
      productName: products.name,
    })
    .from(channelListings)
    .innerJoin(products, eq(channelListings.productId, products.id))
    .where(eq(products.vendorId, vendorId));
}

// Webhook satırını barkoddan bul (kanal içinde benzersiz).
export async function getListingByBarcode(channel: SalesChannel, barcode: string) {
  const [row] = await db
    .select()
    .from(channelListings)
    .where(and(eq(channelListings.channel, channel), eq(channelListings.externalBarcode, barcode)))
    .limit(1);
  return row ?? null;
}

// Bir ürünün AKTİF listing'leri (stok değişince buralara push edilecek).
export async function getActiveListingsForProduct(productId: number) {
  return db
    .select()
    .from(channelListings)
    .where(and(eq(channelListings.productId, productId), eq(channelListings.enabled, true)));
}

// Satıcının bu listing'i olduğunu doğrula (yetki kontrolü) + aç/kapa.
export async function setListingEnabled(listingId: number, vendorId: number, enabled: boolean) {
  const [row] = await db
    .update(channelListings)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(channelListings.id, listingId),
        sql`${channelListings.productId} IN (SELECT id FROM ${products} WHERE ${products.vendorId} = ${vendorId})`,
      ),
    )
    .returning();
  return row ?? null;
}

// ---------- Atomik stok düşümü (aşırı-satış koruması) ----------
// UPDATE ... WHERE stock >= qty: yeterli stok yoksa satır güncellenmez ve null
// döner (çağıran "yetersiz stok" olarak ele alır). Yarış koşulunda güvenli.

export async function atomicDecrementProductStock(productId: number, qty: number): Promise<number | null> {
  const [row] = await db
    .update(products)
    .set({ stock: sql`${products.stock} - ${qty}`, updatedAt: new Date() })
    .where(and(eq(products.id, productId), gte(products.stock, qty)))
    .returning({ stock: products.stock });
  return row?.stock ?? null;
}

export async function atomicDecrementVariantStock(variantId: number, qty: number): Promise<number | null> {
  const [row] = await db
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${qty}` })
    .where(and(eq(productVariants.id, variantId), gte(productVariants.stock, qty)))
    .returning({ stock: productVariants.stock });
  return row?.stock ?? null;
}

// ---------- Outbox (güvenilir dışa-itme) ----------

export async function enqueueOutbox(listingId: number, targetStock: number) {
  await db.insert(stockSyncOutbox).values({ listingId, targetStock });
}

// İşlenmeye hazır (bekleyen + zamanı gelmiş) outbox olayları.
export async function getDueOutbox(limit: number) {
  return db
    .select({
      id: stockSyncOutbox.id,
      listingId: stockSyncOutbox.listingId,
      targetStock: stockSyncOutbox.targetStock,
      attempts: stockSyncOutbox.attempts,
      channel: channelListings.channel,
      externalBarcode: channelListings.externalBarcode,
      enabled: channelListings.enabled,
    })
    .from(stockSyncOutbox)
    .innerJoin(channelListings, eq(stockSyncOutbox.listingId, channelListings.id))
    .where(and(eq(stockSyncOutbox.status, "pending"), lte(stockSyncOutbox.nextAttemptAt, new Date())))
    .limit(limit);
}

export async function markOutboxDone(id: number) {
  await db.update(stockSyncOutbox).set({ status: "done", processedAt: new Date() }).where(eq(stockSyncOutbox.id, id));
}

// Başarısız: attempts++ + geri çekilmeli bir sonraki deneme zamanı.
export async function markOutboxRetry(id: number, error: string, nextAttemptAt: Date) {
  await db
    .update(stockSyncOutbox)
    .set({ status: "pending", attempts: sql`${stockSyncOutbox.attempts} + 1`, lastError: error.slice(0, 500), nextAttemptAt })
    .where(eq(stockSyncOutbox.id, id));
}

// Kalıcı hata (deneme hakkı bitti).
export async function markOutboxFailed(id: number, error: string) {
  await db
    .update(stockSyncOutbox)
    .set({ status: "error", lastError: error.slice(0, 500), processedAt: new Date() })
    .where(eq(stockSyncOutbox.id, id));
}

export async function updateListingSynced(listingId: number, stock: number) {
  await db
    .update(channelListings)
    .set({ lastSyncedStock: stock, lastSyncedAt: new Date(), syncStatus: "synced", syncError: null, updatedAt: new Date() })
    .where(eq(channelListings.id, listingId));
}

export async function updateListingSyncError(listingId: number, error: string) {
  await db
    .update(channelListings)
    .set({ syncStatus: "error", syncError: error.slice(0, 500), updatedAt: new Date() })
    .where(eq(channelListings.id, listingId));
}
