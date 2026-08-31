import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { categories, products, productVariants } from "./catalog";
import { vendors } from "./vendors";

// Dış satış kanalları. Yeni kanal eklenince buraya eklenir (ör. "hepsiburada").
export const salesChannelEnum = pgEnum("sales_channel", ["trendyol", "ikas", "ticimax"]);

// Bir listing/outbox olayının senkron durumu.
export const channelSyncStatusEnum = pgEnum("channel_sync_status", ["pending", "synced", "error"]);
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "processing", "done", "error"]);

// Bir ürün/varyantın belirli bir kanaldaki karşılığı (eşleme kaydı). Trendyol
// barkod ile, İkas SKU/barkod ile, Ticimax ise varyasyon ID'si ile eşler.
// Tarihsel kolon adı externalBarcode olsa da anlamı kanalın stok kayıt anahtarıdır.
export const channelListings = pgTable(
  "channel_listings",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    channel: salesChannelEnum("channel").notNull(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id),
    // Varyantsız üründe null -> stok kaynağı products.stock.
    variantId: bigint("variant_id", { mode: "number" }).references(() => productVariants.id),
    // Kanalda eşleşme anahtarı (barkod/SKU). Kanal başına benzersiz.
    externalBarcode: text("external_barcode").notNull(),
    // Kanalın kendi ürün/stok kayıt kimliği (ilk push/eşleşme sonrası dolar).
    externalProductId: text("external_product_id"),
    // Bu listing aktif senkronlanıyor mu (geçici durdurma için).
    enabled: boolean("enabled").notNull().default(true),
    lastSyncedStock: integer("last_synced_stock"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, precision: 3 }),
    syncStatus: channelSyncStatusEnum("sync_status").notNull().default("pending"),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => ({
    // Aynı ürün+varyant bir kanalda en fazla bir kez listelenir.
    uniqChannelProductVariant: unique("uq_channel_listing_pv").on(t.channel, t.productId, t.variantId),
    // Barkod kanal içinde benzersiz (webhook satırını barkoddan buluruz).
    uniqChannelBarcode: unique("uq_channel_listing_barcode").on(t.channel, t.externalBarcode),
    // Bir kanalın kendi ürün/varyasyon kimliği aynı kanal içinde iki farklı
    // ürüne bağlanamaz. Null değerler (henüz dış kimliği oluşmayan kayıtlar)
    // indekse girmez. Predicate'in enum sabiti kullanmaması, yeni kanal enum'u
    // ile indeksin aynı Drizzle migration transaction'ında güvenle kurulmasını
    // sağlar.
    uniqChannelExternalProduct: uniqueIndex("uq_channel_listing_external_product")
      .on(t.channel, t.externalProductId)
      .where(sql`${t.externalProductId} IS NOT NULL`),
    productIdx: index("idx_channel_listings_product").on(t.productId),
  }),
);

// Her SATICININ kendi kanal (İkas/Trendyol) API kimlik bilgileri — ŞİFRELİ.
// `encrypted` = AES-256-GCM(JSON.stringify(creds)) (bkz. lib/crypto-secret).
// status: connected | error | disconnected. Vendor+kanal başına tek kayıt.
export const vendorChannelCredentials = pgTable(
  "vendor_channel_credentials",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    vendorId: bigint("vendor_id", { mode: "number" }).notNull(),
    channel: salesChannelEnum("channel").notNull(),
    encrypted: text("encrypted").notNull(),
    status: text("status").notNull().default("connected"),
    lastError: text("last_error"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVendorChannel: unique("uq_vendor_channel_cred").on(t.vendorId, t.channel),
  }),
);

// Kanal webhook'lari "at least once" teslim edilir; ayni event ag veya provider
// retry'i ile tekrar gelebilir. Hashlenmis event anahtari kanal icinde unique
// tutulur ve stok dusumuyle AYNI transaction'da yazilir.
export const channelWebhookEvents = pgTable(
  "channel_webhook_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    channel: salesChannelEnum("channel").notNull(),
    eventKey: text("event_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    processedLines: integer("processed_lines").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => ({
    uniqChannelEvent: unique("uq_channel_webhook_event").on(t.channel, t.eventKey),
    createdIdx: index("idx_channel_webhook_events_created").on(t.createdAt),
  }),
);

// Transactional outbox: merkez stok değişince güvenilir (at-least-once) dışa
// itme için buraya yazılır; worker sırayla boşaltır, hata olursa geri çekilmeli
// yeniden dener. Kaçan push'lar reconcile job ile de toparlanır.
export const stockSyncOutbox = pgTable(
  "stock_sync_outbox",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    listingId: bigint("listing_id", { mode: "number" })
      .notNull()
      .references(() => channelListings.id),
    targetStock: integer("target_stock").notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    // Birden fazla API instance'i ayni olayi claim etse bile yalniz aktif
    // lease sahibi sonucu yazabilsin diye fencing token.
    claimToken: text("claim_token"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),
  },
  (t) => ({
    // Worker sorgusu: bekleyen + zamanı gelmiş olaylar.
    dueIdx: index("idx_outbox_due").on(t.status, t.nextAttemptAt).where(sql`${t.status} = 'pending'`),
    listingQueueIdx: index("idx_outbox_listing_queue").on(t.listingId, t.status, t.id),
  }),
);

export type MerchantFeedFieldMapping = {
  itemsPath?: string;
  externalId?: string;
  groupId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  price: string;
  compareAtPrice?: string;
  stock?: string;
  availability?: string;
  imageUrl?: string;
  size?: string;
  color?: string;
};

// Resmi XML/CSV/JSON katalog akislarini API anahtarli kanal
// entegrasyonlarindan ayri tutariz. Feed URL'si query-string/token
// icerebildigi icin AES-GCM ile sifreli saklanir; panel/API URL'yi geri
// dondurmez. Worker lease alanlari birden fazla API instance'inda ayni
// kaynagin eszamanli calismasini engeller.
export const vendorFeedSources = pgTable(
  "vendor_feed_sources",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("generic"),
    format: text("format").notNull().default("auto"),
    feedHost: text("feed_host").notNull(),
    encryptedUrl: text("encrypted_url").notNull(),
    status: text("status").notNull().default("paused"),
    intervalMinutes: integer("interval_minutes").notNull().default(60),
    defaultCategoryId: bigint("default_category_id", { mode: "number" }).notNull().references(() => categories.id),
    fieldMapping: jsonb("field_mapping").$type<MerchantFeedFieldMapping>().notNull(),
    stockBuffer: integer("stock_buffer").notNull().default(0),
    missingGraceRuns: integer("missing_grace_runs").notNull().default(3),
    staleAfterMinutes: integer("stale_after_minutes").notNull().default(180),
    lastEtag: text("last_etag"),
    lastModified: text("last_modified"),
    lastContentHash: text("last_content_hash"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, precision: 3 }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true, precision: 3 }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    lastError: text("last_error"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, precision: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => ({
    vendorNameUnique: unique("uq_vendor_feed_source_name").on(t.vendorId, t.name),
    dueIdx: index("idx_vendor_feed_sources_due").on(t.status, t.nextSyncAt),
    vendorIdx: index("idx_vendor_feed_sources_vendor").on(t.vendorId, t.createdAt),
    defaultCategoryIdx: index("idx_vendor_feed_sources_default_category").on(t.defaultCategoryId),
    intervalCheck: check("vendor_feed_interval_check", sql`${t.intervalMinutes} >= 15 AND ${t.intervalMinutes} <= 1440`),
    stockBufferCheck: check("vendor_feed_stock_buffer_check", sql`${t.stockBuffer} >= 0 AND ${t.stockBuffer} <= 1000000`),
    graceCheck: check("vendor_feed_missing_grace_check", sql`${t.missingGraceRuns} >= 1 AND ${t.missingGraceRuns} <= 10`),
    staleCheck: check("vendor_feed_stale_check", sql`${t.staleAfterMinutes} >= ${t.intervalMinutes} AND ${t.staleAfterMinutes} <= 10080`),
  }),
);

// Her dis satir ile Gulum Salim urun/varyanti arasindaki kalici bag.
// Kaynakta gecici kaybolan satir hemen silinmez: missingRuns esige ulasinca
// yalniz stogu sifirlanir. Finansal/urun gecmisi korunur.
export const vendorFeedItems = pgTable(
  "vendor_feed_items",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    sourceId: bigint("source_id", { mode: "number" }).notNull().references(() => vendorFeedSources.id, { onDelete: "cascade" }),
    externalKey: text("external_key").notNull(),
    groupKey: text("group_key"),
    productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
    variantId: bigint("variant_id", { mode: "number" }).references(() => productVariants.id),
    dataHash: text("data_hash").notNull(),
    // Son basarili feed'de Gulum Salim'a acilan (buffer sonrasi) stok.
    // Yeni feed degeri ile bunun deltasi mevcut yerel stoga uygulanir;
    // Gulum Salim'da arada gerceklesen satislar geri yazimla kaybolmaz.
    sourceStock: integer("source_stock").notNull().default(0),
    missingRuns: integer("missing_runs").notNull().default(0),
    active: boolean("active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => ({
    sourceKeyUnique: unique("uq_vendor_feed_item_key").on(t.sourceId, t.externalKey),
    sourceGroupIdx: index("idx_vendor_feed_items_group").on(t.sourceId, t.groupKey),
    productIdx: index("idx_vendor_feed_items_product").on(t.productId),
    variantIdx: index("idx_vendor_feed_items_variant").on(t.variantId),
    missingCheck: check("vendor_feed_item_missing_check", sql`${t.missingRuns} >= 0`),
    sourceStockCheck: check("vendor_feed_item_source_stock_check", sql`${t.sourceStock} >= 0`),
  }),
);

// Operasyon ve admin denetimi icin immutable calisma ozeti. Feed URL'si veya
// urun verisinin kendisi burada tutulmaz; secret/log sizintisi olusmaz.
export const vendorFeedSyncRuns = pgTable(
  "vendor_feed_sync_runs",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    sourceId: bigint("source_id", { mode: "number" }).notNull().references(() => vendorFeedSources.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    httpStatus: integer("http_status"),
    contentHash: text("content_hash"),
    itemCount: integer("item_count").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    unchangedCount: integer("unchanged_count").notNull().default(0),
    deactivatedCount: integer("deactivated_count").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true, precision: 3 }),
  },
  (t) => ({
    sourceStartedIdx: index("idx_vendor_feed_runs_source_started").on(t.sourceId, t.startedAt),
  }),
);
