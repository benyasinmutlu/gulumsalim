import { z } from "zod";

const scopeEnum = z.enum(["all", "category", "vendor", "product"]);
const typeEnum = z.enum(["percent", "free_shipping"]);

const campaignFields = z.object({
    name: z.string().trim().min(2).max(120),
    type: typeEnum,
    scope: scopeEnum.default("all"),
    scopeId: z.coerce.number().int().positive().nullable().optional(),
    value: z.coerce.number().finite().min(0).max(100).default(0),
    minOrderAmount: z.coerce.number().finite().positive().max(99_999_999.99).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.coerce.boolean().default(true),
  });

function validateCompleteCampaign(input: z.infer<typeof campaignFields>, ctx: z.RefinementCtx) {
    if (input.scope === "all" && input.scopeId != null) {
      ctx.addIssue({ code: "custom", message: "Tüm ürünler kapsamında hedef seçilemez", path: ["scopeId"] });
    }
    if (input.scope !== "all" && input.scopeId == null) {
      ctx.addIssue({ code: "custom", message: "Seçilen kapsam için hedef gerekli", path: ["scopeId"] });
    }
    if (input.type === "percent" && input.value <= 0) {
      ctx.addIssue({ code: "custom", message: "Yüzde kampanyada oran 0'dan büyük olmalı", path: ["value"] });
    }
    if (input.type === "free_shipping" && input.value !== 0) {
      ctx.addIssue({ code: "custom", message: "Ücretsiz kargo kampanyasında oran 0 olmalı", path: ["value"] });
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      ctx.addIssue({ code: "custom", message: "Bitiş başlangıçtan sonra olmalı", path: ["endsAt"] });
    }
}

export const campaignInputSchema = campaignFields.superRefine(validateCompleteCampaign);
export const createCampaignSchema = campaignInputSchema;
export const updateCampaignSchema = campaignFields.partial().refine((input) => Object.keys(input).length > 0, {
  message: "En az bir alan güncellenmeli",
});
export const campaignIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
