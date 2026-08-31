import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { productConditionEnum, productStatusEnum, reviewStatusEnum } from "./enums";
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

// bkz. denetim raporu: "Marka yönetimi" admin panelinde yoktu -
// products.brand her satıcının kendi yazdığı serbest metindi ("Nike",
// "nike", "NIKE" hepsi ayrı görünüyordu). Bu tablo bilerek products.brand'i
// DEĞİŞTİRMEDEN (mevcut ürünler bozulmasın) admin'e gerçek bir marka
// listesi yönetme imkanı verir; satıcı formundaki Marka alanı bu listeyi
// öneri (datalist) olarak kullanır - serbest metin girişini kilitlemez.
export const brands = pgTable("brands", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vendorId: bigint("vendor_id", { mode: "number" }).notNull().references(() => vendors.id),
  categoryId: bigint("category_id", { mode: "number" }).notNull().references(() => categories.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  // Pazaryeri-standardı yapılandırılmış ürün özellikleri. Serbest açıklamadan
  // ayrı tutulur; AI önerileri ancak satıcı formda görüp onayladıktan sonra yazılır.
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
  brand: text("brand"),
  // Fit-Zekâsı Faz 4: satıcının ürüne-özel beden ölçü tablosu (opsiyonel, cm).
  // { "M": { bust: 86, waist: 70 } } — verilirse standart tabloyu ezer (kalıp farkı).
  sizeChart: jsonb("size_chart").$type<Record<string, { bust?: number; waist?: number; hip?: number }>>(),
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
  // bkz. denetim raporu madde 5: "Ürün kondisyonu zorunlu olmalı" - önceden
  // sadece bireysel satıcı akışında, serbest attributes["Durum"] anahtarına
  // gömülü bir değerdi. Nullable kalır (mevcut ürünlerde boş) ama yeni
  // ürün oluşturma şeması (createProductSchema) bunu zorunlu kılar.
  condition: productConditionEnum("condition"),
  // bkz. denetim raporu madde 6: "Kusur/deformasyon sistemi" - önceden
  // serbest metin olarak attributes["Kusur / İz"]'e karışıyordu, ürün
  // detay sayfasında ayrı bir uyarı olarak gösterilmiyordu.
  hasDefect: boolean("has_defect").notNull().default(false),
  defectDescription: text("defect_description"),
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
  // Ürün-zeka yakın-kopya parmak izi (bkz. product-intelligence/dedupe).
  // Aynı satıcının aynı ürünü 2. kez girmesini yakalamak için. Nullable:
  // mevcut ürünlerde boş kalır, dup-kontrolü sadece dolu olanları karşılaştırır.
  fingerprint: text("fingerprint"),
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
  // Satıcı-içi kopya tespiti için (vendorId + fingerprint eşleşmesi).
  fingerprintIdx: index("idx_products_fingerprint").on(table.vendorId, table.fingerprint),
  stockNonnegative: check("chk_products_stock_nonnegative", sql`${table.stock} >= 0`),
}));

// bkz. denetim raporu: "301 yönlendirmeleri" - satıcı bir ürünün adresini
// (slug) değiştirdiğinde eski bağlantılar (arama motoru sonuçları, sosyal
// paylaşımlar, favoriler) 404 vermeye başlıyordu. Eski slug benzersizdir -
// aynı ürün ikinci kez aynı eski adrese dönerse (nadir) tekilliği bozmasın
// diye unique kısıt yok, sadece lookup hızlı olsun diye index var.
export const productSlugHistory = pgTable("product_slug_history", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  oldSlug: text("old_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  oldSlugIdx: index("idx_product_slug_history_old_slug").on(table.oldSlug),
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
  stockNonnegative: check("chk_product_variants_stock_nonnegative", sql`${table.stock} >= 0`),
}));

export const productImages = pgTable("product_images", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  // bkz. denetim raporu madde 6: kusur/deformasyon fotoğrafını genel ürün
  // görsellerinden ayırt eder - ürün detay sayfasındaki kusur uyarısı bu
  // bayrağı taşıyan görselleri ayrıca gösterir.
  isDefectPhoto: boolean("is_defect_photo").notNull().default(false),
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

// bkz. denetim raporu madde 18: "Faydalı soru-cevapların ürün sayfasında
// yayınlanması" - cevaplı sorular arasında en faydalı bulunanların öne
// çıkması için oylama. helpfulCount denormalize edilmedi (drift riski
// yaratmaz) - listAnsweredQuestions bunu bu tablodan COUNT ile hesaplar.
export const productQuestionVotes = pgTable("product_question_votes", {
  questionId: bigint("question_id", { mode: "number" }).notNull().references(() => productQuestions.id),
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("pk_question_votes").on(table.questionId, table.customerId),
}));

export const productFavorites = pgTable("product_favorites", {
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  pk: uniqueIndex("pk_favorites").on(table.customerId, table.productId),
  productIdx: index("idx_favorites_product").on(table.productId),
}));

// Keşif motoru negatif geri bildirimi: kullanıcının "İlgilenmiyorum/Gizle"
// aksiyonları. product_id dolu → o ürünü gizle (hiddenProductIds); category_id
// dolu → o kategoriyle ilgilenme (notInterestedCategoryIds). Discover v1
// profil adapter'ı bunu okur; ranking negativeFeedback + eligibility kullanır.
export const discoverFeedback = pgTable("discover_feedback", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  customerId: bigint("customer_id", { mode: "number" }).notNull(),
  kind: text("kind").notNull(), // 'hide_product' | 'not_interested_category'
  productId: bigint("product_id", { mode: "number" }).references(() => products.id),
  categoryId: bigint("category_id", { mode: "number" }).references(() => categories.id),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  customerIdx: index("idx_discover_feedback_customer").on(table.customerId),
  uniqProduct: uniqueIndex("uniq_discover_feedback_product").on(table.customerId, table.productId),
  uniqCategory: uniqueIndex("uniq_discover_feedback_category").on(table.customerId, table.categoryId),
}));

// Keşif motoru pozitif etkileşim logu (impression/click/view/favorite/add_to_cart).
// A/B ölçümü + geri besleme için. Kimlik DAİMA session'dan (bkz. event-security).
// dedup_key idempotency (aynı mantıksal event tekrarı yazılmaz). Anonim = session_id.
export const discoverEvents = pgTable("discover_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  type: text("type").notNull(),
  customerId: bigint("customer_id", { mode: "number" }),
  sessionId: text("session_id").notNull(),
  productId: bigint("product_id", { mode: "number" }),
  vendorId: bigint("vendor_id", { mode: "number" }),
  categoryId: bigint("category_id", { mode: "number" }),
  source: text("source").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 3 }).notNull(),
  dedupKey: text("dedup_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  uniqDedup: uniqueIndex("uq_discover_events_dedup").on(table.dedupKey),
  lookupIdx: index("idx_discover_events_lookup").on(table.type, table.source, table.occurredAt),
}));

// Fit-Zekâsı Faz 5 (öğrenen katman): müşterinin satın aldıktan sonra verdiği
// "geldi: dar/tam/bol" geri bildirimi (ve iadeler). Ürünün her bedeni için
// kalıp kayması buradan öğrenilir (bkz. modules/fit/feedback.ts). Append-only.
export const fitFeedback = pgTable("fit_feedback", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  customerId: bigint("customer_id", { mode: "number" }),
  sizeNumeric: integer("size_numeric").notNull(),
  verdict: text("verdict").notNull(), // cok_dar | dar | tam | bol | cok_bol
  source: text("source").notNull().default("explicit"), // explicit | return
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  productIdx: index("idx_fit_feedback_product").on(table.productId),
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
