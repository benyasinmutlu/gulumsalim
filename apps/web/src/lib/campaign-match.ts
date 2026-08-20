import type { ActiveCampaign } from "./types";

export function bestCampaignPercent(
  campaigns: ActiveCampaign[],
  product: { id: number; categorySlug: string; vendorSlug: string },
): number | null {
  return bestCampaignForProduct(campaigns, product)?.value ?? null;
}

export function bestCampaignForProduct(
  campaigns: ActiveCampaign[],
  product: { id: number; categorySlug: string; vendorSlug: string },
): ActiveCampaign | null {
  let best: ActiveCampaign | null = null;
  for (const campaign of campaigns) {
    if (campaign.type !== "percent") continue;
    const matches =
      campaign.scope === "all" ||
      (campaign.scope === "category" && campaign.scopeSlug === product.categorySlug) ||
      (campaign.scope === "vendor" && campaign.scopeSlug === product.vendorSlug) ||
      (campaign.scope === "product" && campaign.scopeId === product.id);
    if (matches && (!best || campaign.value > best.value)) best = campaign;
  }
  return best && best.value > 0 ? best : null;
}
