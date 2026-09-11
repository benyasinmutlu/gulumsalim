import { getShippingConfig, shippingProvider } from "../../lib/shipping";
import { listActiveCampaigns } from "./campaign.repository";
import { computeCampaigns, pickBestDiscount } from "./campaign.service";
import { validateAndComputeDiscount } from "./coupon.service";

export interface CheckoutProductInfo {
  vendorId: number;
  categoryId: number;
  freeShipping?: boolean;
  storeName?: string;
}

export interface ResolvedCheckoutTotals {
  subtotal: number;
  shippingFee: number;
  shippingBreakdown: Array<{ storeName: string; fee: string; free: boolean }>;
  freeShippingThreshold: number;
  discountAmount: number;
  total: number;
  couponId: number | null;
  couponCode: string | null;
  campaignId: number | null;
}

// Sepet, ödeme özeti, sözleşme ve gerçek sipariş aynı fiyat motorunu kullanır.
// Böylece müşteriye gösterilen kampanya/kupon/kargo tutarı ile ödeme sağlayıcısına
// gönderilen tutar birbirinden ayrılamaz.
export async function resolveCheckoutTotals(
  items: { productId: number; lineTotal: string }[],
  productMap: Map<number, CheckoutProductInfo>,
  couponCode: string | undefined,
  customerId: number | undefined,
): Promise<ResolvedCheckoutTotals> {
  const { shippingFee: baseShippingFee, freeShippingThreshold } = await getShippingConfig();
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
  const campaigns = computeCampaigns(
    await listActiveCampaigns(),
    items.map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        vendorId: product?.vendorId ?? 0,
        categoryId: product?.categoryId ?? 0,
        lineTotal: Number(item.lineTotal),
      };
    }),
  );
  const freeShippingVendors = new Set(campaigns.freeShippingVendorIds);
  // bkz. kargo/PTT denetim raporu Faz 3 (2026-09-10): "checkout provider
  // üzerinden shipping hesaplayacak" - hesap motoru (ManualShippingProvider)
  // BİREBİR AYNI computeVendorShipping()'i çalıştırıyor, sadece arkasında
  // bir soyutlama var. Kampanya/serbest-kargo çözümlemesi (freeShippingVendors)
  // KASITLI OLARAK burada kalıyor - bu checkout'un sorumluluğu, provider'ın
  // değil (bkz. lib/shipping.ts ShippingProvider yorumu).
  const shipping = await shippingProvider.calculateQuote(
    items.map((item) => {
      const product = productMap.get(item.productId);
      return {
        vendorId: product?.vendorId ?? 0,
        storeName: product?.storeName,
        lineTotal: Number(item.lineTotal),
        freeShipping: product?.freeShipping === true || (product ? freeShippingVendors.has(product.vendorId) : false),
      };
    }),
    baseShippingFee,
    freeShippingThreshold,
  );

  let couponDiscount = 0;
  let couponId: number | null = null;
  let appliedCouponCode: string | null = null;
  if (couponCode) {
    const result = await validateAndComputeDiscount(couponCode, customerId, subtotal);
    couponDiscount = result.discountAmount;
    couponId = result.coupon.id;
    appliedCouponCode = result.coupon.code;
  }
  const best = pickBestDiscount(
    { discount: couponDiscount, id: couponId, code: appliedCouponCode },
    { discount: campaigns.discountAmount, id: campaigns.appliedCampaignId },
  );
  const total = Math.round((subtotal - best.discountAmount + shipping.total + Number.EPSILON) * 100) / 100;

  return {
    subtotal,
    shippingFee: shipping.total,
    shippingBreakdown: shipping.breakdown.map((row) => ({
      storeName: row.storeName ?? "Mağaza",
      fee: row.fee.toFixed(2),
      free: row.free,
    })),
    freeShippingThreshold,
    total,
    ...best,
  };
}
