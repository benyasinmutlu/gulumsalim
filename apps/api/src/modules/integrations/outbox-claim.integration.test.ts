import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(integrationDatabaseUrl))("outbox claim integration", () => {
  let pool: (typeof import("../../db/client"))["pool"];
  let claimDueOutbox: (typeof import("./inventory-sync.repository"))["claimDueOutbox"];
  let markOutboxDone: (typeof import("./inventory-sync.repository"))["markOutboxDone"];
  let processChannelOrderOnce: (typeof import("./channel-order.service"))["processChannelOrderOnce"];
  let orderedListingId: number;
  let webhookProductId: number;
  let webhookBarcode: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl!;
    ({ pool } = await import("../../db/client"));
    ({ claimDueOutbox, markOutboxDone } = await import("./inventory-sync.repository"));
    ({ processChannelOrderOnce } = await import("./channel-order.service"));

    // Bu dosya yalnız özel INTEGRATION_DATABASE_URL verildiğinde çalışır.
    // Önceki koşudan kalan pending outbox satırları global claim sorgusuna
    // karışmasın; test aynı DB üzerinde tekrarlandığında da deterministik olsun.
    await pool.query(
      "TRUNCATE stock_sync_outbox, channel_webhook_events, channel_listings RESTART IDENTITY",
    );

    const suffix = Date.now();
    const category = await pool.query<{ id: string }>(
      "INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id",
      ["Outbox test", `outbox-test-${suffix}`],
    );
    const vendor = await pool.query<{ id: string }>(
      "INSERT INTO vendors (store_name, store_slug, email, password_hash, full_name, status) VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id",
      ["Outbox test", `outbox-test-${suffix}`, `outbox-${suffix}@test.invalid`, "test", "Outbox Test"],
    );
    const productIds: number[] = [];
    for (let index = 0; index < 2; index += 1) {
      const product = await pool.query<{ id: string }>(
        "INSERT INTO products (vendor_id, category_id, name, slug, base_price, stock, status) VALUES ($1, $2, $3, $4, 10, 10, 'active') RETURNING id",
        [vendor.rows[0]!.id, category.rows[0]!.id, `Outbox product ${index}`, `outbox-product-${suffix}-${index}`],
      );
      productIds.push(Number(product.rows[0]!.id));
    }
    const firstListing = await pool.query<{ id: string }>(
      "INSERT INTO channel_listings (channel, product_id, external_barcode) VALUES ('trendyol', $1, $2) RETURNING id",
      [productIds[0], `OUTBOX-${suffix}-A`],
    );
    webhookProductId = productIds[0]!;
    webhookBarcode = `OUTBOX-${suffix}-A`;
    await pool.query(
      "INSERT INTO channel_listings (channel, product_id, external_barcode) VALUES ('ikas', $1, $2)",
      [webhookProductId, `OUTBOX-${suffix}-IKAS`],
    );
    const secondListing = await pool.query<{ id: string }>(
      "INSERT INTO channel_listings (channel, product_id, external_barcode) VALUES ('trendyol', $1, $2) RETURNING id",
      [productIds[1], `OUTBOX-${suffix}-B`],
    );
    orderedListingId = Number(firstListing.rows[0]!.id);
    await pool.query(
      "INSERT INTO stock_sync_outbox (listing_id, target_stock) VALUES ($1, 9), ($1, 8), ($1, 7), ($2, 9)",
      [firstListing.rows[0]!.id, secondListing.rows[0]!.id],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("lets concurrent workers claim distinct rows and preserves per-listing order", async () => {
    const [workerA, workerB] = await Promise.all([claimDueOutbox(10), claimDueOutbox(10)]);
    const firstWave = [...workerA, ...workerB];
    expect(firstWave).toHaveLength(2);
    expect(new Set(firstWave.map((row) => row.id)).size).toBe(2);
    expect(new Set(firstWave.map((row) => row.listingId)).size).toBe(2);

    const orderedListing = firstWave.find((row) => row.listingId === orderedListingId)!;
    expect(orderedListing.claimToken).toBeTruthy();
    expect(await markOutboxDone(orderedListing.id, "stale-worker-token")).toBe(false);
    expect(await markOutboxDone(orderedListing.id, orderedListing.claimToken!)).toBe(true);

    const nextWave = await claimDueOutbox(10);
    const nextForSameListing = nextWave.find((row) => row.listingId === orderedListing.listingId);
    expect(nextForSameListing?.targetStock).toBe(8);
  });

  it("applies a duplicated channel sale once and commits its outbox atomically", async () => {
    const event = {
      channel: "trendyol" as const,
      eventKey: `duplicate-proof-${Date.now()}`,
      payloadHash: "a".repeat(64),
      lines: [{ barcode: webhookBarcode, quantity: 2 }],
    };
    const results = await Promise.all([processChannelOrderOnce(event), processChannelOrderOnce(event)]);
    expect(results.filter((result) => result.duplicate)).toHaveLength(1);
    expect(results.reduce((sum, result) => sum + result.processed, 0)).toBe(1);

    const stock = await pool.query<{ stock: number }>("SELECT stock FROM products WHERE id = $1", [webhookProductId]);
    expect(stock.rows[0]?.stock).toBe(8);
    const events = await pool.query<{ count: string }>(
      "SELECT count(*) FROM channel_webhook_events WHERE channel = 'trendyol' AND event_key = $1",
      [event.eventKey],
    );
    expect(Number(events.rows[0]?.count)).toBe(1);
    const outbox = await pool.query<{ target_stock: number }>(
      "SELECT o.target_stock FROM stock_sync_outbox o JOIN channel_listings l ON l.id = o.listing_id WHERE l.channel = 'ikas' AND l.product_id = $1 ORDER BY o.id DESC LIMIT 1",
      [webhookProductId],
    );
    expect(outbox.rows[0]?.target_stock).toBe(7);
  });
});
