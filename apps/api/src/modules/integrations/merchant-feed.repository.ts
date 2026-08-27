import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  productImages,
  products,
  productVariants,
  vendorFeedItems,
  vendorFeedSources,
  vendorFeedSyncRuns,
  vendors,
  type MerchantFeedFieldMapping,
} from "../../db/schema/index";
import { slugify } from "../../lib/slugify";
import type { FeedFormat, FeedProvider, NormalizedFeedItem } from "./merchant-feed.types";
import { applyFeedStockDelta } from "./merchant-feed.stock";

export type FeedSourceCreate = {
  vendorId: number;
  name: string;
  provider: FeedProvider;
  format: FeedFormat;
  feedHost: string;
  encryptedUrl: string;
  defaultCategoryId: number;
  intervalMinutes: number;
  stockBuffer: number;
  missingGraceRuns: number;
  staleAfterMinutes: number;
  fieldMapping: MerchantFeedFieldMapping;
};

export async function createFeedSource(input: FeedSourceCreate) {
  const [row] = await db.insert(vendorFeedSources).values(input).returning();
  if (!row) throw new Error("Feed kaynağı oluşturulamadı");
  return row;
}

export async function updateFeedSource(vendorId: number, sourceId: number, input: Omit<FeedSourceCreate, "vendorId">) {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(vendorFeedSources).set({
      ...input,
      status: "paused",
      lastEtag: null,
      lastModified: null,
      lastContentHash: null,
      consecutiveFailures: 0,
      lastError: null,
      nextSyncAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(vendorFeedSources.id, sourceId),
      eq(vendorFeedSources.vendorId, vendorId),
      sql`(${vendorFeedSources.leaseExpiresAt} IS NULL OR ${vendorFeedSources.leaseExpiresAt} <= now())`,
    )).returning();
    if (!row) return null;

    const linkedItems = await tx.select().from(vendorFeedItems)
      .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    for (const item of linkedItems) {
      if (item.variantId) await tx.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, item.variantId));
      else await tx.update(products).set({ stock: 0, updatedAt: new Date() }).where(eq(products.id, item.productId));
    }
    if (linkedItems.length > 0) {
      await tx.update(vendorFeedItems).set({ active: false, updatedAt: new Date() })
        .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    }
    return row;
  });
}

export async function listVendorFeedSources(vendorId: number) {
  return db.select({
    id: vendorFeedSources.id,
    name: vendorFeedSources.name,
    provider: vendorFeedSources.provider,
    format: vendorFeedSources.format,
    feedHost: vendorFeedSources.feedHost,
    status: vendorFeedSources.status,
    intervalMinutes: vendorFeedSources.intervalMinutes,
    defaultCategoryId: vendorFeedSources.defaultCategoryId,
    stockBuffer: vendorFeedSources.stockBuffer,
    missingGraceRuns: vendorFeedSources.missingGraceRuns,
    staleAfterMinutes: vendorFeedSources.staleAfterMinutes,
    lastAttemptAt: vendorFeedSources.lastAttemptAt,
    lastSuccessAt: vendorFeedSources.lastSuccessAt,
    nextSyncAt: vendorFeedSources.nextSyncAt,
    consecutiveFailures: vendorFeedSources.consecutiveFailures,
    lastError: vendorFeedSources.lastError,
    createdAt: vendorFeedSources.createdAt,
  }).from(vendorFeedSources).where(eq(vendorFeedSources.vendorId, vendorId)).orderBy(desc(vendorFeedSources.createdAt));
}

export async function listAdminFeedSources() {
  return db.select({
    id: vendorFeedSources.id,
    vendorId: vendorFeedSources.vendorId,
    vendorName: vendors.storeName,
    name: vendorFeedSources.name,
    provider: vendorFeedSources.provider,
    feedHost: vendorFeedSources.feedHost,
    status: vendorFeedSources.status,
    lastSuccessAt: vendorFeedSources.lastSuccessAt,
    nextSyncAt: vendorFeedSources.nextSyncAt,
    consecutiveFailures: vendorFeedSources.consecutiveFailures,
    lastError: vendorFeedSources.lastError,
  }).from(vendorFeedSources).innerJoin(vendors, eq(vendorFeedSources.vendorId, vendors.id)).orderBy(desc(vendorFeedSources.updatedAt));
}

export async function getOwnedFeedSource(vendorId: number, sourceId: number) {
  const [row] = await db.select().from(vendorFeedSources)
    .where(and(eq(vendorFeedSources.id, sourceId), eq(vendorFeedSources.vendorId, vendorId))).limit(1);
  return row ?? null;
}

export async function getFeedSource(sourceId: number) {
  const [row] = await db.select().from(vendorFeedSources).where(eq(vendorFeedSources.id, sourceId)).limit(1);
  return row ?? null;
}

export async function setFeedSourceStatus(vendorId: number, sourceId: number, status: "active" | "paused") {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(vendorFeedSources).set({
      status,
      lastError: status === "active" ? null : undefined,
      consecutiveFailures: status === "active" ? 0 : undefined,
      nextSyncAt: status === "active" ? new Date() : undefined,
      // Duraklatma sonrasi yeniden etkinlestirme her zaman tam govde okumali.
      // Boylece 304 yaniti sifirlanmis stoklari kapali birakmaz.
      lastEtag: null,
      lastModified: null,
      lastContentHash: null,
      updatedAt: new Date(),
    }).where(and(
      eq(vendorFeedSources.id, sourceId),
      eq(vendorFeedSources.vendorId, vendorId),
      sql`(${vendorFeedSources.leaseExpiresAt} IS NULL OR ${vendorFeedSources.leaseExpiresAt} <= now())`,
    )).returning();
    if (!row || status === "active") return row ?? null;

    const linkedItems = await tx.select().from(vendorFeedItems)
      .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    for (const item of linkedItems) {
      if (item.variantId) await tx.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, item.variantId));
      else await tx.update(products).set({ stock: 0, updatedAt: new Date() }).where(eq(products.id, item.productId));
    }
    if (linkedItems.length > 0) {
      await tx.update(vendorFeedItems).set({ active: false, updatedAt: new Date() })
        .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    }
    return row;
  });
}

export async function listFeedRuns(vendorId: number, sourceId: number, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return db.select({
    id: vendorFeedSyncRuns.id,
    status: vendorFeedSyncRuns.status,
    httpStatus: vendorFeedSyncRuns.httpStatus,
    itemCount: vendorFeedSyncRuns.itemCount,
    createdCount: vendorFeedSyncRuns.createdCount,
    updatedCount: vendorFeedSyncRuns.updatedCount,
    unchangedCount: vendorFeedSyncRuns.unchangedCount,
    deactivatedCount: vendorFeedSyncRuns.deactivatedCount,
    error: vendorFeedSyncRuns.error,
    startedAt: vendorFeedSyncRuns.startedAt,
    finishedAt: vendorFeedSyncRuns.finishedAt,
  }).from(vendorFeedSyncRuns)
    .innerJoin(vendorFeedSources, eq(vendorFeedSyncRuns.sourceId, vendorFeedSources.id))
    .where(and(eq(vendorFeedSources.vendorId, vendorId), eq(vendorFeedSources.id, sourceId)))
    .orderBy(desc(vendorFeedSyncRuns.startedAt)).limit(safeLimit);
}

export async function createFeedRun(sourceId: number) {
  const [row] = await db.insert(vendorFeedSyncRuns).values({ sourceId, status: "running" }).returning({ id: vendorFeedSyncRuns.id });
  if (!row) throw new Error("Feed çalışma kaydı oluşturulamadı");
  return row.id;
}

export type FeedRunSummary = {
  status: "success" | "unchanged" | "error" | "rejected";
  httpStatus?: number;
  contentHash?: string;
  itemCount?: number;
  createdCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  deactivatedCount?: number;
  error?: string;
};

export async function finishFeedRun(runId: number, summary: FeedRunSummary) {
  await db.update(vendorFeedSyncRuns).set({
    ...summary,
    error: summary.error?.slice(0, 1000),
    finishedAt: new Date(),
  }).where(eq(vendorFeedSyncRuns.id, runId));
}

export async function claimDueFeedSources(limit = 2, leaseMs = 600_000) {
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const safeLeaseMs = Math.max(60_000, Math.min(10 * 60_000, Math.trunc(leaseMs)));
  const leaseToken = randomUUID();
  return db.transaction(async (tx) => {
    const claimed = await tx.execute(sql<{ id: number }>`
      WITH candidates AS (
        SELECT source.id
        FROM ${vendorFeedSources} AS source
        WHERE source.status = 'active'
          AND source.next_sync_at <= now()
          AND (source.lease_expires_at IS NULL OR source.lease_expires_at <= now())
        ORDER BY source.next_sync_at, source.id
        FOR UPDATE OF source SKIP LOCKED
        LIMIT ${safeLimit}
      )
      UPDATE ${vendorFeedSources} AS target
      SET lease_token = ${leaseToken},
          lease_expires_at = now() + (${safeLeaseMs} * interval '1 millisecond'),
          last_attempt_at = now(),
          updated_at = now()
      FROM candidates
      WHERE target.id = candidates.id
      RETURNING target.id
    `);
    const ids = claimed.rows.map((row) => Number(row.id));
    if (ids.length === 0) return [];
    return tx.select().from(vendorFeedSources).where(inArray(vendorFeedSources.id, ids)).orderBy(vendorFeedSources.id);
  });
}

export async function claimOwnedFeedSource(vendorId: number, sourceId: number, leaseMs = 600_000) {
  const token = randomUUID();
  const now = new Date();
  const [row] = await db.update(vendorFeedSources).set({
    leaseToken: token,
    leaseExpiresAt: new Date(now.getTime() + leaseMs),
    lastAttemptAt: now,
    updatedAt: now,
  }).where(and(
    eq(vendorFeedSources.id, sourceId),
    eq(vendorFeedSources.vendorId, vendorId),
    sql`${vendorFeedSources.status} <> 'paused'`,
    sql`(${vendorFeedSources.leaseExpiresAt} IS NULL OR ${vendorFeedSources.leaseExpiresAt} <= now())`,
  )).returning();
  return row ?? null;
}

export async function markFeedSourceSuccess(
  sourceId: number,
  leaseToken: string,
  input: { status: string; etag?: string; lastModified?: string; contentHash?: string; nextSyncAt: Date },
) {
  const [row] = await db.update(vendorFeedSources).set({
    status: input.status === "paused" ? "paused" : "active",
    lastEtag: input.etag,
    lastModified: input.lastModified,
    lastContentHash: input.contentHash,
    lastSuccessAt: new Date(),
    consecutiveFailures: 0,
    lastError: null,
    nextSyncAt: input.nextSyncAt,
    leaseToken: null,
    leaseExpiresAt: null,
    updatedAt: new Date(),
  }).where(and(eq(vendorFeedSources.id, sourceId), eq(vendorFeedSources.leaseToken, leaseToken))).returning({ id: vendorFeedSources.id });
  return Boolean(row);
}

export async function markFeedSourceFailure(
  sourceId: number,
  leaseToken: string,
  input: { previousStatus: string; error: string; nextAttemptAt: Date; permanent: boolean; resetContentHash?: boolean },
) {
  const [row] = await db.update(vendorFeedSources).set({
    status: input.previousStatus === "paused" ? "paused" : input.permanent ? "error" : "active",
    consecutiveFailures: sql`${vendorFeedSources.consecutiveFailures} + 1`,
    lastError: input.error.slice(0, 1000),
    lastEtag: input.resetContentHash ? null : undefined,
    lastModified: input.resetContentHash ? null : undefined,
    lastContentHash: input.resetContentHash ? null : undefined,
    nextSyncAt: input.nextAttemptAt,
    leaseToken: null,
    leaseExpiresAt: null,
    updatedAt: new Date(),
  }).where(and(eq(vendorFeedSources.id, sourceId), eq(vendorFeedSources.leaseToken, leaseToken))).returning({ id: vendorFeedSources.id });
  return Boolean(row);
}

export async function countActiveFeedItems(sourceId: number): Promise<number> {
  const [row] = await db.select({ value: count() }).from(vendorFeedItems)
    .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
  return Number(row?.value ?? 0);
}

function feedSku(vendorId: number, sourceId: number, item: NormalizedFeedItem): string {
  const readable = (item.sku ?? item.barcode ?? item.externalKey).toLocaleUpperCase("tr-TR")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "ITEM";
  const suffix = createHash("sha256").update(item.externalKey).digest("hex").slice(0, 10).toUpperCase();
  return `FEED-${vendorId}-${sourceId}-${readable}-${suffix}`;
}

function exposedStock(item: NormalizedFeedItem, buffer: number): number {
  return item.available ? Math.max(0, Math.floor(item.stock) - buffer) : 0;
}

export async function applyFeedItems(source: typeof vendorFeedSources.$inferSelect, items: NormalizedFeedItem[]) {
  return db.transaction(async (tx) => {
    if (!source.leaseToken) throw new Error("Feed ürünleri geçerli lease olmadan uygulanamaz");
    // Lease yalnız claim anında değil, katalog transaction'ı içinde de doğrulanır.
    // Kaynak satır kilidi transaction bitene kadar başka worker'ın lease almasını,
    // URL yenilemesini veya kaynağı durdurmasını engeller.
    const [leasedSource] = await tx.select({ id: vendorFeedSources.id }).from(vendorFeedSources)
      .where(and(eq(vendorFeedSources.id, source.id), eq(vendorFeedSources.leaseToken, source.leaseToken)))
      .for("update").limit(1);
    if (!leasedSource) throw new Error("Feed lease süresi doldu veya başka worker tarafından devralındı");
    const existingRows = await tx.select({
      feed: vendorFeedItems,
      productStock: products.stock,
      variantStock: productVariants.stock,
    }).from(vendorFeedItems)
      .innerJoin(products, eq(vendorFeedItems.productId, products.id))
      .leftJoin(productVariants, eq(vendorFeedItems.variantId, productVariants.id))
      .where(eq(vendorFeedItems.sourceId, source.id));
    const existing = existingRows.map((row) => ({
      ...row.feed,
      currentStock: row.variantStock ?? row.productStock,
    }));
    const byExternal = new Map(existing.map((row) => [row.externalKey, row]));
    const groupProducts = new Map(existing.filter((row) => row.groupKey).map((row) => [row.groupKey!, row.productId]));
    const seen = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let deactivatedCount = 0;

    for (const item of items) {
      seen.add(item.externalKey);
      const stock = exposedStock(item, source.stockBuffer);
      const current = byExternal.get(item.externalKey);
      if (current) {
        // Kaynak stogu 10 iken Gulum Salim'da 1 satis olduysa yerel stok 9'dur.
        // Feed sonraki turda hala 10 diyorsa 10'a resetlemek yerine delta=0
        // uygulanir ve 9 korunur. Kaynak 8'e dustuyse delta=-2 -> yerel 7.
        const targetStock = applyFeedStockDelta(current.currentStock, current.sourceStock, stock, current.active);
        await tx.update(products).set({
          name: item.name,
          description: item.description,
          brand: item.brand,
          basePrice: item.price,
          compareAtPrice: item.compareAtPrice,
          ...(current.variantId ? {} : { stock: targetStock }),
          updatedAt: new Date(),
        }).where(and(eq(products.id, current.productId), eq(products.vendorId, source.vendorId)));
        if (current.variantId) {
          await tx.update(productVariants).set({
            size: item.size,
            color: item.color,
            priceOverride: item.price,
            stock: targetStock,
          }).where(eq(productVariants.id, current.variantId));
        }
        if (item.imageUrl) {
          const [hasImage] = await tx.select({ id: productImages.id }).from(productImages)
            .where(and(eq(productImages.productId, current.productId), eq(productImages.url, item.imageUrl))).limit(1);
          if (!hasImage) {
            const [anyImage] = await tx.select({ id: productImages.id }).from(productImages)
              .where(eq(productImages.productId, current.productId)).limit(1);
            await tx.insert(productImages).values({ productId: current.productId, url: item.imageUrl, isPrimary: !anyImage, sortOrder: 0 });
          }
        }
        await tx.update(vendorFeedItems).set({
          groupKey: item.groupKey,
          dataHash: item.dataHash,
          sourceStock: stock,
          missingRuns: 0,
          active: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(vendorFeedItems.id, current.id));
        if (current.dataHash === item.dataHash && current.active) unchangedCount++;
        else updatedCount++;
        continue;
      }

      let productId = item.groupKey ? groupProducts.get(item.groupKey) : undefined;
      let variantId: number | null = null;
      if (!productId) {
        const slugSuffix = createHash("sha256").update(`${source.id}:${item.groupKey ?? item.externalKey}`).digest("hex").slice(0, 10);
        const [product] = await tx.insert(products).values({
          vendorId: source.vendorId,
          categoryId: source.defaultCategoryId,
          name: item.name,
          slug: `${slugify(item.name).slice(0, 120) || "urun"}-${slugSuffix}`,
          description: item.description,
          brand: item.brand,
          basePrice: item.price,
          compareAtPrice: item.compareAtPrice,
          stock: item.groupKey || item.sku || item.size || item.color ? 0 : stock,
          status: "draft",
          fingerprint: createHash("sha256").update(`feed:${source.id}:${item.groupKey ?? item.externalKey}`).digest("hex"),
        }).returning({ id: products.id });
        if (!product) throw new Error("Feed ürünü oluşturulamadı");
        productId = product.id;
        if (item.groupKey) groupProducts.set(item.groupKey, productId);
      }
      if (item.groupKey || item.sku || item.size || item.color) {
        const [variant] = await tx.insert(productVariants).values({
          productId,
          sku: feedSku(source.vendorId, source.id, item),
          size: item.size,
          color: item.color,
          priceOverride: item.price,
          stock,
        }).returning({ id: productVariants.id });
        if (!variant) throw new Error("Feed varyantı oluşturulamadı");
        variantId = variant.id;
      }
      if (item.imageUrl) {
        const [anyImage] = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId)).limit(1);
        if (!anyImage) await tx.insert(productImages).values({ productId, url: item.imageUrl, isPrimary: true, sortOrder: 0 });
      }
      await tx.insert(vendorFeedItems).values({
        sourceId: source.id,
        externalKey: item.externalKey,
        groupKey: item.groupKey,
        productId,
        variantId,
        dataHash: item.dataHash,
        sourceStock: stock,
      });
      createdCount++;
    }

    for (const row of existing) {
      if (seen.has(row.externalKey)) continue;
      const missingRuns = row.missingRuns + 1;
      const deactivate = row.active && missingRuns >= source.missingGraceRuns;
      await tx.update(vendorFeedItems).set({
        missingRuns,
        active: deactivate ? false : row.active,
        updatedAt: new Date(),
      }).where(eq(vendorFeedItems.id, row.id));
      if (deactivate) {
        if (row.variantId) await tx.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, row.variantId));
        else await tx.update(products).set({ stock: 0, updatedAt: new Date() }).where(eq(products.id, row.productId));
        deactivatedCount++;
      }
    }

    return { createdCount, updatedCount, unchangedCount, deactivatedCount };
  });
}

export async function zeroAllSourceStocks(sourceId: number, leaseToken: string): Promise<number> {
  return db.transaction(async (tx) => {
    const [leasedSource] = await tx.select({ id: vendorFeedSources.id }).from(vendorFeedSources)
      .where(and(eq(vendorFeedSources.id, sourceId), eq(vendorFeedSources.leaseToken, leaseToken)))
      .for("update").limit(1);
    if (!leasedSource) return 0;
    const rows = await tx.select().from(vendorFeedItems)
      .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    for (const row of rows) {
      if (row.variantId) await tx.update(productVariants).set({ stock: 0 }).where(eq(productVariants.id, row.variantId));
      else await tx.update(products).set({ stock: 0, updatedAt: new Date() }).where(eq(products.id, row.productId));
    }
    if (rows.length > 0) {
      await tx.update(vendorFeedItems).set({ active: false, updatedAt: new Date() })
        .where(and(eq(vendorFeedItems.sourceId, sourceId), eq(vendorFeedItems.active, true)));
    }
    return rows.length;
  });
}
