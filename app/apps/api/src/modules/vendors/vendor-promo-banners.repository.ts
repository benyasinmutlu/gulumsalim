import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { promoBanners, promoBannerClicks } from "../../db/schema/index";
import { resolveBannerScope } from "../content/promo-banner-scope";

export async function listVendorPromoBanners(vendorId: number) {
  return db.select().from(promoBanners).where(eq(promoBanners.vendorId, vendorId)).orderBy(promoBanners.sortOrder);
}

interface VendorBannerInput {
  title: string;
  image: string;
  linkUrl?: string;
  linkType?: string;
  animStyle?: string;
  subtitle?: string;
  buttonText?: string;
  textColor?: string;
  rotateSeconds?: number;
  sortOrder: number;
}

// gulumsalim.com'daki vendor/promo-banners.php'nin karşılığı - satıcının
// gönderdiği banner her zaman 'pending' olarak başlar, admin onayından
// geçmeden anasayfada hiç görünmez (bkz. content.repository.ts
// listActivePromoBanners'ın status='approved' filtresi).
export async function insertVendorPromoBanner(vendorId: number, data: VendorBannerInput) {
  const [row] = await db
    .insert(promoBanners)
    .values({ ...data, vendorId, status: "pending", rejectionNote: null })
    .returning();
  if (!row) throw new Error("Banner oluşturulamadı");
  return row;
}

export async function updateVendorPromoBanner(
  vendorId: number,
  id: number,
  data: Partial<
    Pick<VendorBannerInput, "title" | "linkUrl" | "linkType" | "animStyle" | "subtitle" | "buttonText" | "textColor" | "rotateSeconds" | "sortOrder">
  > & {
    isActive?: boolean;
  },
) {
  // Düzenleme yeniden admin onayı gerektirir - eski sitedeki yorum: "kaydedilince
  // (yeni ya da düzenleme fark etmeksizin) admin onayı gerekir".
  const [row] = await db
    .update(promoBanners)
    .set({ ...data, status: "pending", rejectionNote: null })
    .where(and(eq(promoBanners.id, id), eq(promoBanners.vendorId, vendorId)))
    .returning();
  return row ?? null;
}

export async function deleteVendorPromoBanner(vendorId: number, id: number) {
  const result = await db
    .delete(promoBanners)
    .where(and(eq(promoBanners.id, id), eq(promoBanners.vendorId, vendorId)))
    .returning({ id: promoBanners.id });
  return result.length > 0;
}

const STATS_WINDOW_DAYS = 14;

// bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı kaç kişi tıkladı
// o tıkladığı kampanyadan herhangi bir ürünü aldıysa veya favoriye
// eklediysede kampanyalarda göster" - admin-content.repository.ts
// getPromoBannerStats ile aynı mantık, tek fark: bannerın bu satıcıya ait
// olduğu doğrulanır (sahiplik kontrolü).
export async function getVendorBannerStats(vendorId: number, bannerId: number) {
  const [banner] = await db
    .select()
    .from(promoBanners)
    .where(and(eq(promoBanners.id, bannerId), eq(promoBanners.vendorId, vendorId)))
    .limit(1);
  if (!banner) return null;

  const [totalViewsRow] = await db
    .select({ count: count() })
    .from(promoBannerClicks)
    .where(and(eq(promoBannerClicks.bannerId, bannerId), eq(promoBannerClicks.eventType, "view")));
  const [totalClicksRow] = await db
    .select({ count: count() })
    .from(promoBannerClicks)
    .where(and(eq(promoBannerClicks.bannerId, bannerId), eq(promoBannerClicks.eventType, "click")));

  const since = new Date();
  since.setDate(since.getDate() - STATS_WINDOW_DAYS);
  since.setHours(0, 0, 0, 0);
  const dailyRows = await db
    .select({ day: sql<string>`to_char(${promoBannerClicks.createdAt}, 'YYYY-MM-DD')`, count: count() })
    .from(promoBannerClicks)
    .where(and(eq(promoBannerClicks.bannerId, bannerId), eq(promoBannerClicks.eventType, "click"), gte(promoBannerClicks.createdAt, since)))
    .groupBy(sql`to_char(${promoBannerClicks.createdAt}, 'YYYY-MM-DD')`);
  const dailyMap = new Map(dailyRows.map((r) => [r.day, r.count]));
  const dailyClicks: { date: string; count: number }[] = [];
  for (let i = STATS_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyClicks.push({ date: key, count: dailyMap.get(key) ?? 0 });
  }

  const scope = await resolveBannerScope(banner);

  return {
    totalViews: totalViewsRow?.count ?? 0,
    totalClicks: totalClicksRow?.count ?? 0,
    dailyClicks,
    scope,
  };
}
