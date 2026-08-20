import { describe, expect, it } from "vitest";
import { campaignInputSchema, updateCampaignSchema } from "./admin-campaigns.schemas";

const valid = { name: "Yaz Kampanyası", type: "percent", scope: "all", value: 10 };

describe("campaignInputSchema", () => {
  it("accepts a complete percent campaign", () => {
    expect(campaignInputSchema.parse(valid)).toMatchObject({ value: 10, isActive: true });
  });

  it.each([
    [{ ...valid, scope: "vendor" }, "missing scoped target"],
    [{ ...valid, scopeId: 4 }, "target on all scope"],
    [{ ...valid, value: 0 }, "zero percent"],
    [{ ...valid, type: "free_shipping", value: 10 }, "value on free shipping"],
    [{ ...valid, startsAt: "2026-08-18", endsAt: "2026-08-17" }, "reverse date range"],
  ])("rejects %s (%s)", (input, _label) => {
    expect(campaignInputSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(false);
  });
});
