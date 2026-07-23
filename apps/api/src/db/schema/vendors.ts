import { bigint, boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { customerMessageSenderEnum, messageSenderEnum, payoutStatusEnum, reviewStatusEnum, vendorStatusEnum } from "./enums";
import { customers } from "./customers";

export const vendors = pgTable("vendors", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  storeName: text("store_name").notNull(),
  storeSlug: text("store_slug").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  status: vendorStatusEnum("status").notNull().default("pending"),
  walletBalance: numeric("wallet_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  bankName: text("bank_name"),
  bankIban: text("bank_iban"),
  bankAccountHolder: text("bank_account_holder"),
  logo: text("logo"),
  isVerified: boolean("is_verified").notNull().default(false),
  // vendor/store.php'nin karşılığı: mağaza profili alanları - önceki
  // denetimde bu alanların şemada bile bulunmadığı tespit edildi.
  about: text("about"),
  coverImage: text("cover_image"),
  city: text("city"),
  whatsapp: text("whatsapp"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  twitter: text("twitter"),
  youtube: text("youtube"),
  tiktok: text("tiktok"),
  website: text("website"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  // Mağaza profil sayfasında gösterilecek bölümlerin sırası/görünürlüğü
  // (ör. [{"type":"collections","visible":true},{"type":"products","visible":true}]).
  // Eski sitedeki vendor_store_sections tablosunun basitleştirilmiş karşılığı.
  storeLayout: jsonb("store_layout").notNull().default([{ type: "collections", visible: true }, { type: "products", visible: true }]),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("idx_vendors_status").on(table.status),
}));

// vendor/store-layout.php'deki satıcıya özel slider yönetiminin karşılığı -
// site geneli `sliders` tablosunun satıcı mağaza sayfası kapsamındaki
// eşdeğeri. Yalnızca storeLayout'ta "slider" bölümü görünür olan satıcılar
// için mağaza sayfasında gösterilir.
export const vendorStoreSlides = pgTable("vendor_store_slides", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  image: text("image").notNull(),
  title: text("title"),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("idx_vendor_store_slides_vendor").on(table.vendorId, table.sortOrder),
}));

// vendor/store-layout.php'deki sosyal medya gönderisi gömme bloklarının
// karşılığı - gerçek Instagram/TikTok gömme script'leri yerine (harici
// script enjeksiyonu güvenlik/güvenilirlik riski taşır), gönderiye
// bağlanan görsel kartlar - vstore-social-item CSS'i zaten bu görünüme göre
// tasarlanmış (bkz. vendor-storefront.tsx sosyal medya LİNK bloğuyla
// karıştırılmasın - o mağaza profilindeki iletişim linkleri, bu ise
// mağaza sayfasına eklenen içerik vitrini).
export const vendorSocialPosts = pgTable("vendor_social_posts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  platform: text("platform").notNull(),
  postUrl: text("post_url").notNull(),
  image: text("image"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("idx_vendor_social_posts_vendor").on(table.vendorId, table.sortOrder),
}));

// Admin <-> satıcı iki yönlü mesajlaşma - eski sitedeki
// vendor_admin_messages tablosunun karşılığı.
export const vendorAdminMessages = pgTable("vendor_admin_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  sender: messageSenderEnum("sender").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("idx_vendor_messages_vendor").on(table.vendorId, table.createdAt),
}));

// Müşteri <-> satıcı iki yönlü mesajlaşma - eski sitedeki vendor/messages.php
// "Müşteri Mesajları" sekmesinin karşılığı, vendorAdminMessages'tan ayrı
// (o admin<->satıcı içindi). Bir (vendorId, customerId) çifti tek bir
// konuşma "thread"i oluşturur.
export const customerVendorMessages = pgTable("customer_vendor_messages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  sender: customerMessageSenderEnum("sender").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  threadIdx: index("idx_customer_vendor_messages_thread").on(table.vendorId, table.customerId, table.createdAt),
}));

// vendor-store.php'deki mağaza değerlendirmesi (ürün değerlendirmesinden
// ayrı - bütün mağaza deneyimine puan) - önceki denetimde tamamen eksik
// olduğu tespit edildi. Bir müşteri bir mağazayı yalnızca bir kez
// değerlendirebilir (unique), en az bir teslim edilmiş siparişi olması
// şartıyla (bkz. reviews.repository.ts findReviewableVendor).
export const vendorReviews = pgTable("vendor_reviews", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull().references(() => customers.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorCustomerUnique: uniqueIndex("uniq_vendor_reviews_vendor_customer").on(table.vendorId, table.customerId),
  vendorStatusIdx: index("idx_vendor_reviews_vendor_status").on(table.vendorId, table.status),
}));

// Satıcı paneli bildirim kutusu (yeni sipariş, yeni soru, admin mesajı vb.) -
// eski sitedeki vendor_notifications tablosunun karşılığı.
export const vendorNotifications = pgTable("vendor_notifications", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorIdx: index("idx_vendor_notifications_vendor").on(table.vendorId, table.isRead, table.createdAt),
}));

export const vendorPayouts = pgTable("vendor_payouts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  iban: text("iban"),
  note: text("note"),
  status: payoutStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true, precision: 3 }),
  processedBy: bigint("processed_by", { mode: "number" }),
  rejectionReason: text("rejection_reason"),
}, (table) => ({
  vendorIdx: index("idx_payouts_vendor").on(table.vendorId),
}));
