import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../content/content.repository", () => ({
  getPublicSettings: vi.fn(async () => ({ shipping_cost: "49.90", free_shipping_limit: "500" })),
}));
vi.mock("./campaign.repository", () => ({ listActiveCampaigns: vi.fn() }));
vi.mock("./coupon.service", () => ({ validateAndComputeDiscount: vi.fn() }));

import { listActiveCampaigns } from "./campaign.repository";
import { validateAndComputeDiscount } from "./coupon.service";
import { resolveCheckoutTotals } from "./checkout-totals";

const productMap = new Map([
  [1, { vendorId: 7, categoryId: 3, freeShipping: false, storeName: "Test Mağaza" }],
]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActiveCampaigns).mockResolvedValue([]);
});

describe("resolveCheckoutTotals", () => {
  it("uses the campaign in the same quote sent to checkout", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 11, type: "percent", scope: "all", scopeId: null, value: 10, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);

    const totals = await resolveCheckoutTotals([{ productId: 1, lineTotal: "399.90" }], productMap, undefined, 5);

    expect(totals).toMatchObject({
      subtotal: 399.9,
      shippingFee: 49.9,
      discountAmount: 39.99,
      total: 409.81,
      campaignId: 11,
      couponCode: null,
    });
  });

  it("picks the better coupon and keeps the campaign out of the applied quote", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 11, type: "percent", scope: "all", scopeId: null, value: 10, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);
    vi.mocked(validateAndComputeDiscount).mockResolvedValue({
      coupon: { id: 22, code: "DAHAİYİ" },
      discountAmount: 50,
    } as never);

    const totals = await resolveCheckoutTotals([{ productId: 1, lineTotal: "399.90" }], productMap, "dahaiyi", 5);

    expect(totals).toMatchObject({ discountAmount: 50, couponId: 22, couponCode: "DAHAİYİ", campaignId: null, total: 399.8 });
  });

  it("applies a free-shipping campaign to its matching vendor", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 33, type: "free_shipping", scope: "vendor", scopeId: 7, value: 0, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);

    const totals = await resolveCheckoutTotals([{ productId: 1, lineTotal: "100.00" }], productMap, undefined, undefined);

    expect(totals.shippingFee).toBe(0);
    expect(totals.shippingBreakdown).toEqual([{ storeName: "Test Mağaza", fee: "0.00", free: true }]);
    expect(totals.total).toBe(100);
  });
});
