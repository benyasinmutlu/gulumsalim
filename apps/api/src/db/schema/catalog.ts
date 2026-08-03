import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productStatusEnum, reviewStatusEnum } from "./enums";
import { vendors } from "./vendors";

export const categories = pgTable("categories", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  parentId: bigint("parent_id", { mode: "number" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  iconColor: text("icon_color"),
  image: text("image"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
});

export const products = pgTable("products", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  categoryId: bigint("category_id", { mode: "number" }).notNull().references(() => categories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  brand: text("brand"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),
  // Ürün tanıtım videosu (opsiyonel) - satıcı panelinden yüklenir, S3'e gider,
  // ürün detay sayfasında oynatılır. Nullable: çoğu üründe olmayacak.
  videoUrl: text("video_url"),
  // bkz. kullanıcı isteği: "admin paneli ve satıcı paneli üzerinden her
  // ürüne ... kargo ... düzenleyeceğimiz alanlar olsun". Site genelinde tek
  // bir kargo ücreti/ücretsiz kargo eşiği zaten settings'te var (bkz.
  // checkout.service.ts getShippingConfig) - burada bilinçli olarak serbest
  // metin bir "özel ücret" DEĞİL, basit bir geçersiz kılma eklendi: bu
  // ürün sepette varsa (VE sepetteki diğer tüm kalemler de aynı bayrağı
  // taşıyorsa) kargo ücreti sıfırlanır. Karışık sepetlerde kalem başına
  // kargo ücreti toplama gibi çok daha riskli bir yeniden hesaplamaya
  // girmeden, ödeme akışını bozmadan güvenli bir kapsam.
  freeShipping: boolean("free_shipping").notNull().default(false),
  // bkz. kullanıcı isteği: "bireysel olarak müşteri olarak kayıt olan
  // kişilerde satış yapabilsin 2. el ürün letgo dolap gibi" - ürün
  // listelemede/kartlarda "2. El" rozeti ve ayrı filtre için.
  isSecondHand: boolean("is_second_hand").notNull().default(false),
  // bkz. kullanıcı isteği: "kurumsal satıcıların stokları zorunlu olarak
  // girilmeli bireysel satıcıların ise sattığı ürünün stoğu 1 olacak sadece
  // satılınca kaldırılacak websitesinden" - önceden varyantsız ürünlerde hiç
  // stok kavramı yoktu (sadece product_variants.stock vardı). Bu alan SADECE
  // varyantsız ürünlerde anlamlıdır (bkz. vendor-products.repository.ts
  // listVendorProducts totalStock hesaplaması) - varyantı olan bir üründe
  // stok gerçek kaynağı hâlâ product_variants'tır, bu sütun kullanılmaz.
  // Bireysel satıcıda oluşturulurken sunucu tarafında hep 1'e zorlanır (bkz.
  // vendor-products.routes.ts POST); satılınca order.repository.ts
  // decrementOrderItemStock 0'a indirir ve ürünü otomatik "inactive" yapar.
  stock: integer("stock").notNull().default(0),
  status: productStatusEnum("status").notNull().default("draft"),
  // gulumsalim.com'daki products.views'in karşılığı - admin dashboard'daki
  // "Müşterilerin En Çok Baktığı Ürünler" için basit bir sayaç. Detaylı
  // davranışsal analiz zaten Redis Stream + Go keşfet servisinde yapılıyor
  // (bkz. events.client.ts) - bu, ondan bağımsız, doğrudan sorgulanabilir
  // bir toplam sayaç.
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  // Ana ürün gözat sorgusu: kategori + fiyat aralığı, sadece aktif ürünler.
  // Partial index tutar: küçük kalır, katalog 1M+'a çıksa bile hızlı.
  activeListingIdx: index("idx_products_active_listing")
    .on(table.categoryId, table.basePrice)
    .where(sql`${table.status} = 'active'`),
  keysetIdx: index("idx_products_keyset").on(table.status, table.createdAt, table.id),
  vendorIdx: index("idx_products_vendor").on(table.vendorId, table.status),
}));

export const productVariants = pgTable("product_variants", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  sku: text("sku").notNull().unique(),
  size: text("size"),
  color: text("color"),
  priceOverride: numeric("price_override", { precision: 10, scale: 2 }),
  stock: integer("stock").notNull().default(0),
}, (table) => ({
  productIdx: index("idx_variants_product").on(table.productId),
}));

export const productImages = pgTable("product_images", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
}, (table) => ({
  productIdx: index("idx_images_product").on(table.productId),
}));

export const productReviews = pgTable("product_reviews", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  orderItemId: bigint("order_item_id", { mode: "number" }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  // vendor/reviews.php'deki satıcı yanıt formunun karşılığı.
  vendorReply: text("vendor_reply"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  productStatusIdx: index("idx_reviews_product_status").on(table.productId, table.status),
  // Aynı sipariş kalemine iki kez yorum yapılamaz - findReviewableOrderItem()
  // bunu okuma anında da kontrol ediyor ama bu, çift tıklama gibi yarış
  // durumlarına karşı veritabanı seviyesinde son güvence.
  orderItemUnique: uniqueIndex("uniq_reviews_order_item").on(table.orderItemId),
}));

export const productQuestions = pgTable("product_questions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export const productFavorites = pgTable("product_favorites", {
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("pk_favorites").on(table.customerId, table.productId),
  productIdx: index("idx_favorites_product").on(table.productId),
}));

// Satıcının kendi mağaza vitrininde ürünlerini gruplamak için kullandığı
// koleksiyonlar (ör. "Yaz Kreasyonu") - eski sitedeki collections/
// collection_products tablolarının karşılığı.
export const collections = pgTable("collections", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  vendorSlugIdx: uniqueIndex("uniq_collections_vendor_slug").on(table.vendorId, table.slug),
}));

export const collectionProducts = pgTable("collection_products", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  collectionId: bigint("collection_id", { mode: "number" }).notNull().references(() => collections.id),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  uniquePair: uniqueIndex("uniq_collection_product").on(table.collectionId, table.productId),
}));
