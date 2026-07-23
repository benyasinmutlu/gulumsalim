import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { promoBanners } from "../../db/schema/index";

export async function listVendorPromoBanners(vendorId: number) {
  return db.select().from(promoBanners).where(eq(promoBanners.vendorId, vendorId)).orderBy(promoBanners.sortOrder);
}

interface VendorBannerInput {
  title: string;
  image: string;
  linkUrl?: string;
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
  data: Partial<Pick<VendorBannerInput, "title" | "linkUrl" | "subtitle" | "buttonText" | "textColor" | "rotateSeconds" | "sortOrder">> & {
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
