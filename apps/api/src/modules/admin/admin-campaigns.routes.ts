import type { FastifyPluginAsync } from "fastify";
import {
  campaignTargetExists,
  createCampaign,
  deleteCampaignIfUnused,
  findCampaignById,
  listCampaigns,
  updateCampaign,
} from "../orders/campaign.repository";
import { campaignIdParamsSchema, campaignInputSchema, createCampaignSchema, updateCampaignSchema } from "./admin-campaigns.schemas";

const adminCampaignsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/campaigns", { preHandler: app.requireAdmin }, async (_request, reply) => reply.send(await listCampaigns()));

  app.post("/admin/campaigns", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createCampaignSchema.parse(request.body);
    const scopeId = input.scope === "all" ? null : input.scopeId ?? null;
    if (!(await campaignTargetExists(input.scope, scopeId))) {
      return reply.status(400).send({ error: { message: "Kampanya hedefi bulunamadı" } });
    }
    const campaign = await createCampaign({
      ...input,
      scopeId,
      value: input.value.toFixed(2),
      minOrderAmount: input.minOrderAmount == null ? null : input.minOrderAmount.toFixed(2),
    });
    return reply.status(201).send(campaign);
  });

  app.patch("/admin/campaigns/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = campaignIdParamsSchema.parse(request.params);
    const patch = updateCampaignSchema.parse(request.body);
    const current = await findCampaignById(id);
    if (!current) return reply.status(404).send({ error: { message: "Kampanya bulunamadı" } });

    const merged = campaignInputSchema.parse({
      name: patch.name ?? current.name,
      type: patch.type ?? current.type,
      scope: patch.scope ?? current.scope,
      scopeId:
        patch.scope !== undefined
          ? patch.scope === "all" ? null : patch.scopeId
          : patch.scopeId !== undefined ? patch.scopeId : current.scopeId,
      value: patch.value ?? Number(current.value),
      minOrderAmount: patch.minOrderAmount !== undefined ? patch.minOrderAmount : current.minOrderAmount,
      startsAt: patch.startsAt !== undefined ? patch.startsAt : current.startsAt,
      endsAt: patch.endsAt !== undefined ? patch.endsAt : current.endsAt,
      isActive: patch.isActive ?? current.isActive,
    });
    const scopeId = merged.scope === "all" ? null : merged.scopeId ?? null;
    if (!(await campaignTargetExists(merged.scope, scopeId))) {
      return reply.status(400).send({ error: { message: "Kampanya hedefi bulunamadı" } });
    }

    const campaign = await updateCampaign(id, {
      name: merged.name,
      type: merged.type,
      scope: merged.scope,
      scopeId,
      value: merged.value.toFixed(2),
      minOrderAmount: merged.minOrderAmount == null ? null : merged.minOrderAmount.toFixed(2),
      startsAt: merged.startsAt ?? null,
      endsAt: merged.endsAt ?? null,
      isActive: merged.isActive,
    });
    return reply.send(campaign);
  });

  app.delete("/admin/campaigns/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = campaignIdParamsSchema.parse(request.params);
    const result = await deleteCampaignIfUnused(id);
    if (result === "not_found") return reply.status(404).send({ error: { message: "Kampanya bulunamadı" } });
    if (result === "in_use") return reply.status(409).send({ error: { message: "Kullanılmış kampanya silinemez; pasifleştirin" } });
    return reply.send({ ok: true });
  });
};

export default adminCampaignsRoutes;
