import { countCustomerRedemptions, findCouponByCode } from "./coupon.repository";

export class CouponNotFoundError extends Error {}
export class CouponExpiredError extends Error {}
export class CouponMinOrderError extends Error {
  constructor(public minOrderAmount: number) {
    super("Bu kupon için minimum sepet tutarına ulaşılmadı");
  }
}
export class CouponUsageLimitError extends Error {}

export interface CouponRow {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrderAmount: string | null;
  maxUsesTotal: number | null;
  maxUsesPerCustomer: number;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

// Sepet/checkout'un HER ikisi de (tam sepet ya da selectedLines ile
// daraltılmış alt küme) aynı fonksiyonu kullanır - indirim her zaman o an
// ÖDENECEK subtotal'a göre hesaplanır, asla sepetin tamamına göre değil
// (bkz. checkout.routes.ts filterCartBySelection ile aynı prensip).
export async function validateAndComputeDiscount(
  code: string,
  customerId: number | undefined,
  subtotal: number,
): Promise<{ coupon: CouponRow; discountAmount: number }> {
  const coupon = await findCouponByCode(code);
  if (!coupon || !coupon.isActive) throw new CouponNotFoundError();

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new CouponExpiredError();
  if (coupon.endsAt && coupon.endsAt < now) throw new CouponExpiredError();

  if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
    throw new CouponMinOrderError(Number(coupon.minOrderAmount));
  }

  if (coupon.maxUsesTotal !== null && coupon.usedCount >= coupon.maxUsesTotal) {
    throw new CouponUsageLimitError();
  }

  if (customerId) {
    const usedByCustomer = await countCustomerRedemptions(coupon.id, customerId);
    if (usedByCustomer >= coupon.maxUsesPerCustomer) throw new CouponUsageLimitError();
  }

  const discountAmount =
    coupon.type === "percent" ? Math.round(subtotal * (Number(coupon.value) / 100) * 100) / 100 : Math.min(Number(coupon.value), subtotal);

  return { coupon, discountAmount };
}
