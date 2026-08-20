import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { homepageSectionBanners, promoBannerClicks, promoBannerImages, promoBanners, sliders } from "../../db/schema/index";
import { resolveBannerScope } from "../content/promo-banner-scope";

export async function listAllSliders() {
  return db.select().from(sliders).orderBy(sliders.sortOrder);
}

interface SliderInput {
  image: string;
  linkUrl?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  textColor?: string;
  textPosition?: string;
  sortOrder: number;
}

export async function insertSlider(data: SliderInput) {
  const [row] = await db.insert(sliders).values(data).returning();
  if (!row) throw new Error("Slider oluşturulamadı");
  return row;
}

export async function updateSlider(
  id: number,
  data: Partial<
    Pick<SliderInput, "linkUrl" | "title" | "subtitle" | "buttonText" | "textColor" | "textPosition" | "sortOrder"> & {
      isActive: boolean;
    }
  >,
) {
  const [row] = await db.update(sliders).set(data).where(eq(sliders.id, id)).returning();
  return row ?? null;
}

export async function deleteSlider(id: number) {
  const result = await db.delete(sliders).where(eq(sliders.id, id)).returning({ id: sliders.id });
  return result.length > 0;
}

export async function listAllPromoBanners() {
  return db.select().from(promoBanners).orderBy(promoBanners.sortOrder);
}

interface PromoBannerInput {
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

export async function insertPromoBanner(data: PromoBannerInput) {
  const [row] = await db.insert(promoBanners).values(data).returning();
  if (!row) throw new Error("Banner oluşturulamadı");
  return row;
}

export async function updatePromoBanner(
  id: number,
  data: Partial<
    Pick<PromoBannerInput, "title" | "linkUrl" | "linkType" | "animStyle" | "subtitle" | "buttonText" | "textColor" | "rotateSeconds" | "sortOrder"> & {
      isActive: boolean;
    }
  >,
) {
  const [row] = await db.update(promoBanners).set(data).where(eq(promoBanners.id, id)).returning();
  return row ?? null;
}

// promo_banner_clicks/promo_banner_images/homepage_section_banners,
// promoBanners.id'ye CASCADE olmayan bir FK ile bağlı - bu yüzden görüntülenmiş
// (view/click kaydı oluşmuş) ya da bir bölüme sabitlenmiş bir banner, önce
// bu bağımlı satırlar temizlenmeden silinemiyordu (Postgres FK ihlali,
// 500 hatası). Silme artık tek transaction'da önce bağımlıları temizliyor.
export async function deletePromoBanner(id: number) {
  return db.transaction(async (tx) => {
    await tx.delete(promoBannerClicks).where(eq(promoBannerClicks.bannerId, id));
    await tx.delete(promoBannerImages).where(eq(promoBannerImages.bannerId, id));
    await tx.delete(homepageSectionBanners).where(eq(homepageSectionBanners.bannerId, id));
    const result = await tx.delete(promoBanners).where(eq(promoBanners.id, id)).returning({ id: promoBanners.id });
    return result.length > 0;
  });
}

// gulumsalim.com'daki admin/promo-banners.php'nin onay/red işlemlerinin
// karşılığı - sadece satıcının gönderdiği bannerlar için anlamlı, admin'in
// kendi eklediği bannerlar zaten 'approved' olarak başlıyor.
export async function approvePromoBanner(id: number) {
  const [row] = await db
    .update(promoBanners)
    .set({ status: "approved", rejectionNote: null })
    .where(eq(promoBanners.id, id))
    .returning();
  return row ?? null;
}

export async function rejectPromoBanner(id: number, note?: string) {
  const [row] = await db
    .update(promoBanners)
    .set({ status: "rejected", rejectionNote: note ?? null })
    .where(eq(promoBanners.id, id))
    .returning();
  return row ?? null;
}

// admin/promo-banners.php'deki "Ek Görseller (döngü için)" özelliğinin
// karşılığı - bir bannerın ana görseline ek olarak anasayfada döngüyle
// gösterilecek ek görseller.
export async function listPromoBannerImages(bannerId: number) {
  return db.select().from(promoBannerImages).where(eq(promoBannerImages.bannerId, bannerId)).orderBy(asc(promoBannerImages.sortOrder));
}

export async function addPromoBannerImage(bannerId: number, image: string) {
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${promoBannerImages.sortOrder}), 0)` })
    .from(promoBannerImages)
    .where(eq(promoBannerImages.bannerId, bannerId));
  const [row] = await db
    .insert(promoBannerImages)
    .values({ bannerId, image, sortOrder: (maxRow?.max ?? 0) + 1 })
    .returning();
  if (!row) throw new Error("Döngü görseli eklenemedi");
  return row;
}

export async function deletePromoBannerImage(imageId: number) {
  const result = await db.delete(promoBannerImages).where(eq(promoBannerImages.id, imageId)).returning({ id: promoBannerImages.id });
  return result.length > 0;
}

const STATS_WINDOW_DAYS = 14;

// admin/promo-banners.php'deki istatistik panelinin karşılığı: toplam +
// günlük tıklama sayısı, ve banner "kategori"/"mağaza"ya bağlıysa o
// kapsamdaki favori/satış rakamlarıyla basit bir korelasyon. linkType
// "url" ise (veya slug çözümlenemezse) kapsam null döner - eski sitede de
// bu korelasyon sadece kategori/satıcı bannerları için anlamlıydı.
export async function getPromoBannerStats(bannerId: number) {
  const [banner] = await db.select().from(promoBanners).where(eq(promoBanners.id, bannerId)).limit(1);
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

// bkz. kullanıcı isteği: "kategoriler sayfalar koleksiyonlar mağazalar
// kampanyalar ... çok önemli" - İçerik Analitiği sayfasının "Kampanya
// Bannerları" sekmesi için, TÜM bannerların seçili gün/hafta/ay aralığındaki
// view+click toplamı. getPromoBannerStats'tan farkı: tekil banner değil,
// tüm bannerları sıralayıp döner.
export async function getTopPromoBanners(from: Date, to: Date, limit = 10) {
  const rows = await db
    .select({
      id: promoBanners.id,
      title: promoBanners.title,
      image: promoBanners.image,
      eventType: promoBannerClicks.eventType,
      count: count(),
    })
    .from(promoBannerClicks)
    .innerJoin(promoBanners, eq(promoBannerClicks.bannerId, promoBanners.id))
    .where(and(gte(promoBannerClicks.createdAt, from), sql`${promoBannerClicks.createdAt} <= ${to}`))
    .groupBy(promoBanners.id, promoBanners.title, promoBanners.image, promoBannerClicks.eventType);

  const byBanner = new Map<number, { id: number; title: string; image: string; views: number; clicks: number }>();
  for (const row of rows) {
    const entry = byBanner.get(row.id) ?? { id: row.id, title: row.title, image: row.image, views: 0, clicks: 0 };
    if (row.eventType === "view") entry.views = row.count;
    else if (row.eventType === "click") entry.clicks = row.count;
    byBanner.set(row.id, entry);
  }
  return [...byBanner.values()].sort((a, b) => b.views - a.views).slice(0, limit);
}
