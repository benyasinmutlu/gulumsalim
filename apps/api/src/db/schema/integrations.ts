import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { products, productVariants } from "./catalog";

// Dış satış kanalları. Yeni kanal eklenince buraya eklenir (ör. "hepsiburada").
export const salesChannelEnum = pgEnum("sales_channel", ["trendyol", "ikas"]);

// Bir listing/outbox olayının senkron durumu.
export const channelSyncStatusEnum = pgEnum("channel_sync_status", ["pending", "synced", "error"]);
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "processing", "done", "error"]);

// Bir ürün/varyantın belirli bir kanaldaki karşılığı (eşleme kaydı). Trendyol
// barkod ile, İkas SKU/barkod ile eşler -> externalBarcode = bizim sku (varyant)
// veya ürün-türevi bir kod. externalProductId ilk senkrondan sonra dolar.
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
