import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { coupons, couponRedemptions, orders } from "../../db/schema/index";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findCouponByCode(code: string) {
  const [row] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.trim().toUpperCase()))
    .limit(1);
  return row ?? null;
}

// Anasayfadaki "İlk Alışverişine Özel İndirim" kartı için - admin'in
// isFeatured işaretlediği, hâlâ aktif/süresi geçmemiş TEK kuponu döner.
export async function findFeaturedActiveCoupon() {
  const now = new Date();
  const candidates = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.isFeatured, true), eq(coupons.isActive, true)))
    .orderBy(desc(coupons.createdAt))
    .limit(5);
  // startsAt/endsAt kontrolü burada (SQL'de değil) yapılır - en fazla 5
  // adaylık küçük bir liste için basit/okunur kalsın diye.
  return candidates.find((c) => (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt >= now)) ?? null;
}

export async function countCustomerRedemptions(couponId: number, customerId: number) {
  const rows = await db
    .select({ id: couponRedemptions.id })
    .from(couponRedemptions)
    .where(and(eq(couponRedemptions.couponId, couponId), eq(couponRedemptions.customerId, customerId)));
  return rows.length;
}

// Ödeme GERÇEKTEN başarılı olunca çağrılır (bkz. checkout.service.ts
// handlePaymentCallback) - vendor_earnings/behavioral event'lerle aynı
// prensip, sipariş oluşturma anında değil.
export async function reserveCouponUse(tx: Tx, couponId: number, customerId: number): Promise<boolean> {
  const rows = await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(and(eq(coupons.id, couponId), or(isNull(coupons.maxUsesTotal), lt(coupons.usedCount, coupons.maxUsesTotal))))
    .returning({ id: coupons.id, maxUsesPerCustomer: coupons.maxUsesPerCustomer });
  if (rows.length !== 1) return false;

  // Yukaridaki UPDATE kupon satirini kilitler. Ayni kuponla eszamanli iki
  // checkout bu noktadan seri gecer; dolayisiyla pending siparisler dahil
  // musteri limiti TOCTOU yarisi olmadan denetlenir. Bu transaction rollback
  // olursa usedCount artisi ve siparis de birlikte geri alinir.
  const [usage] = await tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(orders)
    .where(and(
      eq(orders.couponId, couponId),
      eq(orders.customerId, customerId),
      inArray(orders.paymentStatus, ["pending", "paid", "refunded"]),
    ));
  return (usage?.count ?? 0) <= rows[0]!.maxUsesPerCustomer;
}

export async function releaseCouponUse(tx: Tx, couponId: number): Promise<void> {
  await tx
    .update(coupons)
    .set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` })
    .where(eq(coupons.id, couponId));
}

export async function recordCouponRedemption(couponId: number, customerId: number, orderId: number) {
  await db.insert(couponRedemptions).values({ couponId, customerId, orderId });
}

export async function listCoupons() {
  return db.select().from(coupons).orderBy(desc(coupons.createdAt));
}

export async function createCoupon(data: {
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrderAmount?: string;
  maxUsesTotal?: number;
  maxUsesPerCustomer: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive: boolean;
  isFeatured: boolean;
}) {
  const [row] = await db
    .insert(coupons)
    .values({ ...data, code: data.code.trim().toUpperCase() })
    .returning();
  return row!;
}

export async function updateCoupon(
  id: number,
  data: Partial<{
    type: "percent" | "fixed";
    value: string;
    minOrderAmount: string | null;
    maxUsesTotal: number | null;
    maxUsesPerCustomer: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    isFeatured: boolean;
  }>,
) {
  const [row] = await db.update(coupons).set(data).where(eq(coupons.id, id)).returning();
  return row ?? null;
}
