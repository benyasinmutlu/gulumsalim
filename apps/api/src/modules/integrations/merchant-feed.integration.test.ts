import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { vendorFeedSources } from "../../db/schema/index";

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(integrationDatabaseUrl))("merchant feed database integration", () => {
  let pool: (typeof import("../../db/client"))["pool"];
  let db: (typeof import("../../db/client"))["db"];
  let schema: typeof import("../../db/schema/index");
  let applyFeedItems: (typeof import("./merchant-feed.repository"))["applyFeedItems"];
  let claimOwnedFeedSource: (typeof import("./merchant-feed.repository"))["claimOwnedFeedSource"];
  let markFeedSourceFailure: (typeof import("./merchant-feed.repository"))["markFeedSourceFailure"];
  let markFeedSourceSuccess: (typeof import("./merchant-feed.repository"))["markFeedSourceSuccess"];
  let setFeedSourceStatus: (typeof import("./merchant-feed.repository"))["setFeedSourceStatus"];
  let source: typeof vendorFeedSources.$inferSelect;
  let firstExternalKey: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl!;
    ({ db, pool } = await import("../../db/client"));
    schema = await import("../../db/schema/index");
    ({ applyFeedItems, claimOwnedFeedSource, markFeedSourceFailure, markFeedSourceSuccess, setFeedSourceStatus } = await import("./merchant-feed.repository"));

    const suffix = Date.now();
    const [category] = await db.insert(schema.categories).values({ name: "Feed test", slug: `feed-test-${suffix}` }).returning();
    const [vendor] = await db.insert(schema.vendors).values({
      storeName: "Feed Test",
      storeSlug: `feed-test-${suffix}`,
      email: `feed-${suffix}@test.invalid`,
      passwordHash: "test",
      fullName: "Feed Test",
      status: "active",
    }).returning();
    const [createdSource] = await db.insert(schema.vendorFeedSources).values({
      vendorId: vendor!.id,
      name: "Test feed",
      provider: "generic",
      format: "xml",
      feedHost: "example.com",
      encryptedUrl: "test-only",
      status: "active",
      defaultCategoryId: category!.id,
      fieldMapping: { externalId: "id", name: "name", price: "price", stock: "stock" },
      stockBuffer: 0,
      missingGraceRuns: 3,
      staleAfterMinutes: 180,
    }).returning();
    source = createdSource!;
    firstExternalKey = `A-${suffix}`;
  });

  afterAll(async () => {
    await pool?.end();
  });

  function item(externalKey: string, stock: number, dataHash: string) {
    return {
      externalKey,
      sku: externalKey,
      name: "Feed ürünü",
      price: "100.00",
      stock,
      available: stock > 0,
      dataHash,
    };
  }

  async function applyWithLease(items: ReturnType<typeof item>[]) {
    const claimed = await claimOwnedFeedSource(source.vendorId, source.id);
    expect(claimed?.leaseToken).toBeTruthy();
    const result = await applyFeedItems(claimed!, items);
    await markFeedSourceSuccess(source.id, claimed!.leaseToken!, {
      status: "active",
      nextSyncAt: new Date(),
    });
    return result;
  }

  it("preserves local sales while applying external stock deltas atomically", async () => {
    await applyWithLease([item(firstExternalKey, 10, "a"), item(`${firstExternalKey}-KEEP`, 5, "k")]);
    const [feedItem] = await db.select().from(schema.vendorFeedItems).where(eq(schema.vendorFeedItems.externalKey, firstExternalKey));
    expect(feedItem?.variantId).toBeTruthy();

    await db.update(schema.productVariants).set({ stock: 9 }).where(eq(schema.productVariants.id, feedItem!.variantId!));
    await applyWithLease([item(firstExternalKey, 10, "b"), item(`${firstExternalKey}-KEEP`, 5, "k")]);
    let [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, feedItem!.variantId!));
    expect(variant?.stock).toBe(9);

    await applyWithLease([item(firstExternalKey, 8, "c"), item(`${firstExternalKey}-KEEP`, 5, "k")]);
    [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, feedItem!.variantId!));
    expect(variant?.stock).toBe(7);
  });

  it("uses grace runs before fail-closing a missing item", async () => {
    for (let run = 0; run < 2; run++) await applyWithLease([item(`${firstExternalKey}-KEEP`, 5, `keep-${run}`)]);
    let [feedItem] = await db.select().from(schema.vendorFeedItems).where(eq(schema.vendorFeedItems.externalKey, firstExternalKey));
    expect(feedItem?.active).toBe(true);
    expect(feedItem?.missingRuns).toBe(2);

    await applyWithLease([item(`${firstExternalKey}-KEEP`, 5, "keep-3")]);
    [feedItem] = await db.select().from(schema.vendorFeedItems).where(eq(schema.vendorFeedItems.externalKey, firstExternalKey));
    const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, feedItem!.variantId!));
    expect(feedItem?.active).toBe(false);
    expect(variant?.stock).toBe(0);
  });

  it("fences concurrent manual sync attempts with a lease", async () => {
    const first = await claimOwnedFeedSource(source.vendorId, source.id);
    const second = await claimOwnedFeedSource(source.vendorId, source.id);
    expect(first?.leaseToken).toBeTruthy();
    expect(second).toBeNull();

    await db.update(schema.vendorFeedSources).set({
      lastEtag: "stale-etag",
      lastModified: "stale-date",
      lastContentHash: "stale-hash",
    }).where(eq(schema.vendorFeedSources.id, source.id));
    await markFeedSourceFailure(source.id, first!.leaseToken!, {
      previousStatus: "active",
      error: "stale feed",
      nextAttemptAt: new Date(),
      permanent: false,
      resetContentHash: true,
    });
    const [reset] = await db.select().from(schema.vendorFeedSources).where(eq(schema.vendorFeedSources.id, source.id));
    expect(reset?.lastEtag).toBeNull();
    expect(reset?.lastModified).toBeNull();
    expect(reset?.lastContentHash).toBeNull();
  });

  it("serializes checkout and feed stock changes without losing the local sale", async () => {
    const raceKey = `${firstExternalKey}-RACE`;
    await applyWithLease([item(raceKey, 10, "race-initial")]);
    const [feedItem] = await db.select().from(schema.vendorFeedItems)
      .where(eq(schema.vendorFeedItems.externalKey, raceKey));
    expect(feedItem?.variantId).toBeTruthy();

    const checkout = await pool.connect();
    let committed = false;
    let syncPromise: ReturnType<typeof applyWithLease> | undefined;
    try {
      await checkout.query("BEGIN");
      const locked = await checkout.query<{ stock: number }>(
        "SELECT stock FROM product_variants WHERE id = $1 FOR UPDATE",
        [feedItem!.variantId!],
      );
      expect(locked.rows[0]?.stock).toBe(10);
      await checkout.query("UPDATE product_variants SET stock = stock - 1 WHERE id = $1", [feedItem!.variantId!]);

      // Dış stok da 10 -> 9 düşerken feed transaction'ı aynı varyant
      // kilidinde beklemeli. Checkout commit olduktan sonra güncel yerel stok
      // 9 üzerinden -1 delta uygulayıp 8 bırakması gerekir.
      syncPromise = applyWithLease([item(raceKey, 9, "race-next")]);
      let observedLockWait = false;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const waiting = await pool.query<{ waiting: string }>(`
          SELECT count(*)::text AS waiting
          FROM pg_stat_activity
          WHERE pid <> pg_backend_pid()
            AND wait_event_type = 'Lock'
            AND query ILIKE '%product_variants%'
        `);
        if (Number(waiting.rows[0]?.waiting ?? 0) > 0) {
          observedLockWait = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(observedLockWait).toBe(true);

      await checkout.query("COMMIT");
      committed = true;
      await syncPromise;

      const [variant] = await db.select().from(schema.productVariants)
        .where(eq(schema.productVariants.id, feedItem!.variantId!));
      expect(variant?.stock).toBe(8);
    } finally {
      if (!committed) await checkout.query("ROLLBACK").catch(() => undefined);
      checkout.release();
      if (!committed) await syncPromise?.catch(() => undefined);
    }
  });

  it("atomically fail-closes stock when a source is paused", async () => {
    const paused = await setFeedSourceStatus(source.vendorId, source.id, "paused");
    expect(paused?.status).toBe("paused");
    const activeItems = await db.select().from(schema.vendorFeedItems)
      .where(eq(schema.vendorFeedItems.sourceId, source.id));
    expect(activeItems.every((itemRow) => itemRow.active === false)).toBe(true);
    for (const itemRow of activeItems) {
      if (!itemRow.variantId) continue;
      const [variant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, itemRow.variantId));
      expect(variant?.stock).toBe(0);
    }
    expect(await claimOwnedFeedSource(source.vendorId, source.id)).toBeNull();
  });
});
