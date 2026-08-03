import { bigint, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// bkz. kullanıcı isteği (2026-08-02): "kategoriler sayfalar koleksiyonlar
// mağazalar kampanyalar ... çok önemli bunlar ... bu datalar kaydedilsin" -
// ürün/kategori/koleksiyon/mağaza/anasayfa bölümü için TEK bir ham olay
// logu (promo_banner_clicks ile aynı kurulmuş desen - bkz. content.ts). TTL
// yok, süresiz saklanır; gün/hafta/ay kırılımı okuma anında createdAt
// aralığına göre hesaplanır (bkz. content-analytics.repository.ts).
export const contentAnalyticsTypeEnum = pgEnum("content_analytics_type", [
  "product",
  "category",
  "collection",
  "vendor",
  "homepage_section",
]);

export const contentEvents = pgTable(
  "content_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    contentType: contentAnalyticsTypeEnum("content_type").notNull(),
    contentId: bigint("content_id", { mode: "number" }).notNull(),
    // 'view' | 'dwell' | 'purchase' | 'favorite' | 'cart_add' - sabit bir enum
    // yerine text: yeni bir olay türü eklemek yeni bir migration gerektirmesin.
    eventType: text("event_type").notNull(),
    // dwell'de milisaniye, purchase'da adet, diğerlerinde 1 (basit sayaç).
    value: integer("value").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => ({
    lookupIdx: index("idx_content_events_lookup").on(table.contentType, table.contentId, table.eventType, table.createdAt),
  }),
);

// bkz. kullanıcı isteği: "arananlarda bile ... içerik analitiği sayfasında
// gösterilsin" - müşterilerin ürün aramasında yazdığı terimler.
export const searchQueries = pgTable(
  "search_queries",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => ({
    createdIdx: index("idx_search_queries_created").on(table.createdAt),
  }),
);
