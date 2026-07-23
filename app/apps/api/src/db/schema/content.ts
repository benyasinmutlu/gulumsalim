import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { refundStatusEnum, sectionAlgoEnum } from "./enums";
import { products } from "./catalog";
import { vendors } from "./vendors";

export const pages = pgTable("pages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  showInFooter: boolean("show_in_footer").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

// Ana sayfa, admin'in bu tabloda kurduğu sıralı bölümlerden oluşur.
// `config` her algoritma türüne özgü parametreleri tutar (örn.
// discover_personalized için { limit }, manual için { productIds }) —
// yeni bir algoritma eklemek yeni bir kolon değil, yeni bir config şekli
// ve `algo_type` değeri gerektirir.
export const homepageSections = pgTable("homepage_sections", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  algoType: sectionAlgoEnum("algo_type").notNull(),
  config: jsonb("config").notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  // homepage-sections.php'deki seo_slug'ın karşılığı - dolu olduğunda bölüm,
  // anasayfadaki satırın yanı sıra kök seviyede kendi herkese-açık sayfasını
  // da alır (bkz. [slug]/page.tsx zincirine eklenen 3. adım). Sayfa/mağaza/
  // kategori slug'larıyla aynı ad alanını paylaştığı için unique.
  seoSlug: text("seo_slug").unique(),
});

// gulumsalim.com'daki admin/homepage-collections.php'nin karşılığı -
// homepage_sections'daki algoritmik bölümlerden farklı olarak, admin'in
// herhangi bir satıcıdan elle seçtiği ürünlerle kurduğu bir anasayfa
// vitrini (ör. "Yaz Favorileri"). `linkType`/`linkValue`, "Tümünü Gör"
// butonunun nereye gideceğini belirler (kategori/mağaza/özel URL).
export const homepageCollections = pgTable("homepage_collections", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  textColor: text("text_color"),
  linkType: text("link_type"),
  linkValue: text("link_value"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const homepageCollectionProducts = pgTable("homepage_collection_products", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  homepageCollectionId: bigint("homepage_collection_id", { mode: "number" })
    .notNull()
    .references(() => homepageCollections.id),
  productId: bigint("product_id", { mode: "number" }).notNull().references(() => products.id),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  uniquePair: uniqueIndex("pk_homepage_collection_products").on(table.homepageCollectionId, table.productId),
  collectionIdx: index("idx_homepage_collection_products_collection").on(table.homepageCollectionId),
}));

export const sliders = pgTable("sliders", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  image: text("image").notNull(),
  linkUrl: text("link_url"),
  title: text("title"),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  textColor: text("text_color"),
  textPosition: text("text_position"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// gulumsalim.com'daki admin/vendor promo-banners.php'nin karşılığı - admin
// panelden eklenenler doğrudan `approved`, satıcı panelinden gönderilenler
// `vendorId` dolu ve `pending` olarak başlar, admin onaylayana/reddedene
// kadar anasayfada görünmez.
export const promoBanners = pgTable("promo_banners", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  image: text("image").notNull(),
  linkUrl: text("link_url"),
  // "url" | "category" | "vendor" - homepage_collections'daki linkType/
  // linkValue desenle aynı (bkz. content.repository.ts resolveCollectionLink).
  // linkType "url" değilse linkUrl alanı gerçek bir adres değil, hedef
  // kategori/mağaza slug'ı taşır.
  linkType: text("link_type").notNull().default("url"),
  // bkz. kullanıcı isteği: "bannerları özelleştirebilsin animasyon efekt vs
  // gibi bir çok detay olsun" - homepage_sections.animStyle ile aynı
  // seçenek seti (fade-up/zoom-in/slide-left/fade), banner bazında.
  animStyle: text("anim_style"),
  subtitle: text("subtitle"),
  buttonText: text("button_text"),
  textColor: text("text_color"),
  rotateSeconds: integer("rotate_seconds"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  vendorId: bigint("vendor_id", { mode: "number" }).references(() => vendors.id),
  status: refundStatusEnum("status").notNull().default("approved"),
  rejectionNote: text("rejection_note"),
});

// admin/promo-banners.php'deki tıklama-istatistik panelinin karşılığı -
// her tıklamada tek satır eklenir, admin panelde bannera göre
// toplam/günlük tıklama sayısı ve bağlı kategori/mağaza kapsamındaki
// favori/satış korelasyonu için kullanılır (bkz. admin-promo-banners.routes.ts
// /:id/stats).
// bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı kaç kişi tıkladı" -
// eventType "view" (banner ekranda görüldüğünde, bkz.
// promo-banner-impression.tsx) veya "click" (bkz. promo-banner-link.tsx)
// olabilir. Aynı tabloda tutulur (banner_id + zaman damgası şeması zaten
// aynı, ayrı bir tablo gereksiz tekrar olurdu).
export const promoBannerClicks = pgTable("promo_banner_clicks", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  bannerId: bigint("banner_id", { mode: "number" }).notNull().references(() => promoBanners.id),
  eventType: text("event_type").notNull().default("click"),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
}, (table) => ({
  bannerIdx: index("idx_promo_banner_clicks_banner").on(table.bannerId),
}));

// admin/promo-banners.php'deki "Ek Görseller (döngü için)" özelliğinin
// karşılığı - bir banner sabit ana görseline ek olarak, anasayfada
// rotate_seconds aralıklarla değişen ek görseller alabilir (bkz.
// components/promo-banner-image.tsx). Önceki denetimde bu tablo/özellik
// hiç taşınmamıştı.
export const promoBannerImages = pgTable("promo_banner_images", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  bannerId: bigint("banner_id", { mode: "number" }).notNull().references(() => promoBanners.id),
  image: text("image").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  bannerIdx: index("idx_promo_banner_images_banner").on(table.bannerId),
}));

// homepage-sections.php'deki "Kampanya Bannerları" bölümüne özel banner
// seçimi/sıralamasının karşılığı - bir bölüm için hiç satır yoksa, o bölüm
// tüm onaylı+aktif bannerları gösterir (mevcut varsayılan davranış);
// satır varsa SADECE seçilenler, seçilen sırada gösterilir.
export const homepageSectionBanners = pgTable("homepage_section_banners", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  sectionId: bigint("section_id", { mode: "number" }).notNull().references(() => homepageSections.id),
  bannerId: bigint("banner_id", { mode: "number" }).notNull().references(() => promoBanners.id),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({
  uniquePair: uniqueIndex("uniq_section_banner").on(table.sectionId, table.bannerId),
  sectionIdx: index("idx_section_banners_section").on(table.sectionId),
}));

// Basit anahtar/değer site ayarları (marka renkleri, iletişim bilgisi vb.)
// — eski PHP'deki `settings` tablosunun birebir karşılığı.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
