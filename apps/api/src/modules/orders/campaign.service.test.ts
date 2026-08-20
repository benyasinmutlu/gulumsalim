import { describe, expect, it } from "vitest";
import { computeCampaigns, pickBestDiscount, type Campaign, type CartItemForCampaign } from "./campaign.service";

const item = (overrides: Partial<CartItemForCampaign> = {}): CartItemForCampaign => ({
  productId: 1,
  vendorId: 10,
  categoryId: 100,
  lineTotal: 200,
  ...overrides,
});

const campaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 1,
  type: "percent",
  scope: "all",
  scopeId: null,
  value: 20,
  minOrderAmount: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  ...overrides,
});

describe("computeCampaigns", () => {
  it("applies a percent campaign only to matching items", () => {
    const result = computeCampaigns(
      [campaign({ scope: "category", scopeId: 100, value: 25 })],
      [item({ categoryId: 100, lineTotal: 200 }), item({ categoryId: 200, lineTotal: 400 })],
    );
    expect(result.discountAmount).toBe(50);
    expect(result.appliedCampaignId).toBe(1);
  });

  it("chooses the greatest monetary discount rather than the greatest percentage", () => {
    const result = computeCampaigns(
      [
        campaign({ id: 1, scope: "product", scopeId: 1, value: 50 }),
        campaign({ id: 2, scope: "all", value: 20 }),
      ],
      [item({ productId: 1, lineTotal: 10 }), item({ productId: 2, lineTotal: 100 })],
    );
    expect(result).toMatchObject({ discountAmount: 22, appliedCampaignId: 2 });
  });

  it("honors date, active and minimum-order boundaries", () => {
    const now = new Date("2026-08-17T12:00:00Z");
    expect(computeCampaigns([campaign({ startsAt: now, endsAt: now })], [item()], now).discountAmount).toBe(40);
    expect(computeCampaigns([campaign({ minOrderAmount: 201 })], [item()], now).discountAmount).toBe(0);
    expect(computeCampaigns([campaign({ isActive: false })], [item()], now).discountAmount).toBe(0);
  });

  it("rounds currency to two decimals", () => {
    expect(computeCampaigns([campaign({ value: 33.33 })], [item({ lineTotal: 10.01 })]).discountAmount).toBe(3.34);
  });

  it("collects unique free-shipping vendors while retaining the best discount", () => {
    const result = computeCampaigns(
      [campaign({ value: 10 }), campaign({ id: 2, type: "free_shipping", scope: "all", value: 0 })],
      [item({ vendorId: 10 }), item({ vendorId: 20 })],
    );
    expect(result.discountAmount).toBe(40);
    expect(new Set(result.freeShippingVendorIds)).toEqual(new Set([10, 20]));
  });
});

describe("pickBestDiscount", () => {
  it("does not stack coupon and campaign discounts", () => {
    expect(pickBestDiscount({ discount: 50, id: 7, code: "IND50" }, { discount: 30, id: 2 })).toEqual({
      discountAmount: 50,
      couponId: 7,
      couponCode: "IND50",
      campaignId: null,
    });
    expect(pickBestDiscount({ discount: 20, id: 7, code: "IND20" }, { discount: 45, id: 3 })).toEqual({
      discountAmount: 45,
      couponId: null,
      couponCode: null,
      campaignId: 3,
    });
  });

  it("prefers the explicitly entered coupon on a tie", () => {
    expect(pickBestDiscount({ discount: 40, id: 7, code: "X" }, { discount: 40, id: 3 }).couponId).toBe(7);
  });
});
