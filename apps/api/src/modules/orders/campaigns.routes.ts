import type { FastifyPluginAsync } from "fastify";
import { listCampaignVendors, listLiveCampaignRows } from "./campaign.repository";

function campaignLabel(type: string, value: number): string {
  return type === "percent" ? `%${Number.isInteger(value) ? value : value.toFixed(1)} İndirim` : "Ücretsiz Kargo";
}

const campaignsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/campaigns", async (_request, reply) => {
    const rows = await listLiveCampaignRows();
    return reply.send(rows.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      scope: campaign.scope,
      scopeId: campaign.scopeId,
      value: Number(campaign.value),
      minOrderAmount: campaign.minOrderAmount == null ? null : Number(campaign.minOrderAmount),
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      scopeSlug: campaign.scope === "category" ? campaign.categorySlug : campaign.scope === "vendor" ? campaign.vendorSlug : null,
    })));
  });

  app.get("/campaigns/vendors", async (_request, reply) => {
    const rows = await listCampaignVendors();
    return reply.send(rows.map((vendor) => ({
      vendorId: vendor.vendorId,
      storeName: vendor.storeName,
      storeSlug: vendor.storeSlug,
      logo: vendor.logo,
      campaignLabel: campaignLabel(vendor.type, Number(vendor.value)),
      campaignName: vendor.campaignName,
    })));
  });
};

export default campaignsRoutes;
