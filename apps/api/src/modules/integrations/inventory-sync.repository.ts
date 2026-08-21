import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { channelListings, products, productVariants, stockSyncOutbox } from "../../db/schema/index";
import type { SalesChannel } from "./inventory-sync";

// ---------- Kanal listing (ürün ↔ kanal eşleme) ----------

export interface NewChannelListing {
  channel: SalesChannel;
  productId: number;
  variantId?: number | null;
  externalBarcode: string;
  externalProductId?: string | null;
}

export async function insertChannelListing(data: NewChannelListing, vendorId: number) {
  const [owned] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, data.productId), eq(products.vendorId, vendorId)))
    .limit(1);
  if (!owned) return null;
  const [row] = await db
    .insert(channelListings)
    .values({
      channel: data.channel,
      productId: data.productId,
      variantId: data.variantId ?? null,
      externalBarcode: data.externalBarcode,
      externalProductId: data.externalProductId ?? null,
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
      externalProductId: channelListings.externalProductId,
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

// Bir VARYANTIN aktif listing'leri (varyant satılınca bunlara push edilir).
export async function getActiveListingsForVariant(variantId: number) {
  return db
    .select()
    .from(channelListings)
    .where(and(eq(channelListings.variantId, variantId), eq(channelListings.enabled, true)));
}

// Reconcile için: bir kanalın tüm aktif listing'leri + MERKEZ stoğu (varyant
// varsa varyant stoğu, yoksa ürün stoğu). Kanaldan çekilen stokla karşılaştırılır.
export async function getEnabledListingsWithStock(channel: SalesChannel) {
  const rows = await db
    .select({
      listingId: channelListings.id,
      barcode: channelListings.externalBarcode,
      variantId: channelListings.variantId,
      productStock: products.stock,
      variantStock: productVariants.stock,
      vendorId: products.vendorId,
    })
    .from(channelListings)
    .innerJoin(products, eq(channelListings.productId, products.id))
    .leftJoin(productVariants, eq(channelListings.variantId, productVariants.id))
    .where(and(eq(channelListings.channel, channel), eq(channelListings.enabled, true)));
  return rows.map((r) => ({
    listingId: r.listingId,
    barcode: r.barcode,
    vendorId: r.vendorId,
    centralStock: r.variantId != null ? (r.variantStock ?? 0) : r.productStock,
  }));
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

// İşlenmeye hazır olayları atomik claim eder. FOR UPDATE SKIP LOCKED sayesinde
// birden çok worker aynı satırı alamaz. Aynı listing'in daha eski pending veya
// processing olayı varken yenisi seçilmez; mutlak stok değerleri dış kanala
// daima oluşma sırasıyla gider. Süresi dolan processing lease'i crash recovery
// için tekrar claim edilebilir.
export async function claimDueOutbox(limit: number, leaseMs = 60_000) {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 500));
  const safeLeaseMs = Math.max(30_000, Math.min(Math.trunc(leaseMs), 15 * 60_000));
  const claimToken = randomUUID();

  return db.transaction(async (tx) => {
    const claimed = await tx.execute(sql<{ id: number }>`
      WITH candidates AS (
        SELECT candidate.id
        FROM ${stockSyncOutbox} AS candidate
        WHERE (
          (candidate.status = 'pending' AND candidate.next_attempt_at <= now())
          OR (candidate.status = 'processing' AND candidate.next_attempt_at <= now())
        )
        AND NOT EXISTS (
          SELECT 1
          FROM ${stockSyncOutbox} AS older
          WHERE older.listing_id = candidate.listing_id
            AND older.id < candidate.id
            AND older.status IN ('pending', 'processing')
        )
        ORDER BY candidate.id
        FOR UPDATE OF candidate SKIP LOCKED
        LIMIT ${safeLimit}
      )
      UPDATE ${stockSyncOutbox} AS target
      SET status = 'processing',
          claim_token = ${claimToken},
          next_attempt_at = now() + (${safeLeaseMs} * interval '1 millisecond')
      FROM candidates
      WHERE target.id = candidates.id
      RETURNING target.id
    `);
    const ids = claimed.rows.map((row) => Number(row.id));
    if (ids.length === 0) return [];

    return tx
      .select({
        id: stockSyncOutbox.id,
        listingId: stockSyncOutbox.listingId,
        targetStock: stockSyncOutbox.targetStock,
        attempts: stockSyncOutbox.attempts,
        claimToken: stockSyncOutbox.claimToken,
        channel: channelListings.channel,
        externalBarcode: channelListings.externalBarcode,
        externalProductId: channelListings.externalProductId,
        enabled: channelListings.enabled,
        // Per-vendor kimlik bilgisi araması için: listing → ürün → satıcı.
        vendorId: products.vendorId,
      })
      .from(stockSyncOutbox)
      .innerJoin(channelListings, eq(stockSyncOutbox.listingId, channelListings.id))
      .innerJoin(products, eq(channelListings.productId, products.id))
      .where(inArray(stockSyncOutbox.id, ids))
      .orderBy(stockSyncOutbox.id);
  });
}

export async function markOutboxDone(id: number, claimToken: string): Promise<boolean> {
  const rows = await db
    .update(stockSyncOutbox)
    .set({ status: "done", claimToken: null, processedAt: new Date() })
    .where(and(eq(stockSyncOutbox.id, id), eq(stockSyncOutbox.status, "processing"), eq(stockSyncOutbox.claimToken, claimToken)))
    .returning({ id: stockSyncOutbox.id });
  return rows.length === 1;
}

// Başarısız: attempts++ + geri çekilmeli bir sonraki deneme zamanı.
export async function markOutboxRetry(id: number, claimToken: string, error: string, nextAttemptAt: Date): Promise<boolean> {
  const rows = await db
    .update(stockSyncOutbox)
    .set({
      status: "pending",
      claimToken: null,
      attempts: sql`${stockSyncOutbox.attempts} + 1`,
      lastError: error.slice(0, 500),
      nextAttemptAt,
    })
    .where(and(eq(stockSyncOutbox.id, id), eq(stockSyncOutbox.status, "processing"), eq(stockSyncOutbox.claimToken, claimToken)))
    .returning({ id: stockSyncOutbox.id });
  return rows.length === 1;
}

// Kalıcı hata (deneme hakkı bitti).
export async function markOutboxFailed(id: number, claimToken: string, error: string): Promise<boolean> {
  const rows = await db
    .update(stockSyncOutbox)
    .set({ status: "error", claimToken: null, lastError: error.slice(0, 500), processedAt: new Date() })
    .where(and(eq(stockSyncOutbox.id, id), eq(stockSyncOutbox.status, "processing"), eq(stockSyncOutbox.claimToken, claimToken)))
    .returning({ id: stockSyncOutbox.id });
  return rows.length === 1;
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
