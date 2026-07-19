import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sectionAlgoEnum } from "./enums";

export const pages = pgTable("pages", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  content: text("content").notNull(),
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
});

export const sliders = pgTable("sliders", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  image: text("image").notNull(),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const promoBanners = pgTable("promo_banners", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  image: text("image").notNull(),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// Basit anahtar/değer site ayarları (marka renkleri, iletişim bilgisi vb.)
// — eski PHP'deki `settings` tablosunun birebir karşılığı.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
