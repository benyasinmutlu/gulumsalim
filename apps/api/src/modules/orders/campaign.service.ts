export type CampaignType = "percent" | "free_shipping";
export type CampaignScope = "all" | "category" | "vendor" | "product";

export interface Campaign {
  id: number;
  type: CampaignType;
  scope: CampaignScope;
  scopeId: number | null;
  value: number;
  minOrderAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface CartItemForCampaign {
  productId: number;
  vendorId: number;
  categoryId: number;
  lineTotal: number;
}

export interface CampaignOutcome {
  discountAmount: number;
  appliedCampaignId: number | null;
  freeShippingVendorIds: number[];
}

function matchesItem(campaign: Campaign, item: CartItemForCampaign): boolean {
  if (campaign.scope === "all") return true;
  if (campaign.scope === "category") return campaign.scopeId === item.categoryId;
  if (campaign.scope === "vendor") return campaign.scopeId === item.vendorId;
  return campaign.scopeId === item.productId;
}

function isLive(campaign: Campaign, now: Date): boolean {
  return campaign.isActive && (!campaign.startsAt || campaign.startsAt <= now) && (!campaign.endsAt || campaign.endsAt >= now);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeCampaigns(campaigns: Campaign[], items: CartItemForCampaign[], now = new Date()): CampaignOutcome {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  let discountAmount = 0;
  let appliedCampaignId: number | null = null;
  const freeShippingVendorIds = new Set<number>();

  for (const campaign of campaigns) {
    if (!isLive(campaign, now)) continue;
    if (campaign.minOrderAmount !== null && subtotal < campaign.minOrderAmount) continue;

    const eligibleItems = items.filter((item) => matchesItem(campaign, item));
    if (eligibleItems.length === 0) continue;

    if (campaign.type === "free_shipping") {
      for (const item of eligibleItems) freeShippingVendorIds.add(item.vendorId);
      continue;
    }

    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const candidate = roundMoney(eligibleSubtotal * campaign.value / 100);
    if (candidate > discountAmount) {
      discountAmount = candidate;
      appliedCampaignId = campaign.id;
    }
  }

  return { discountAmount, appliedCampaignId, freeShippingVendorIds: [...freeShippingVendorIds] };
}

export function pickBestDiscount(
  coupon: { discount: number; id: number | null; code: string | null },
  campaign: { discount: number; id: number | null },
) {
  if (coupon.discount >= campaign.discount) {
    return { discountAmount: coupon.discount, couponId: coupon.id, couponCode: coupon.code, campaignId: null };
  }
  return { discountAmount: campaign.discount, couponId: null, couponCode: null, campaignId: campaign.id };
}
