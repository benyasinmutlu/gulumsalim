import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./coupon.repository", () => ({
  findCouponByCode: vi.fn(),
  countCustomerRedemptions: vi.fn(),
}));

import {
  CouponExpiredError,
  CouponMinOrderError,
  CouponNotFoundError,
  CouponUsageLimitError,
  validateAndComputeDiscount,
} from "./coupon.service";
import { countCustomerRedemptions, findCouponByCode } from "./coupon.repository";

const baseCoupon = {
  id: 1,
  code: "GULUM100",
  type: "fixed" as const,
  value: "100.00",
  minOrderAmount: null,
  maxUsesTotal: null,
  maxUsesPerCustomer: 1,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

beforeEach(() => vi.clearAllMocks());

describe("validateAndComputeDiscount", () => {
  it("throws CouponNotFoundError for an unknown code", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue(null);
    await expect(validateAndComputeDiscount("NOPE", undefined, 500)).rejects.toThrow(CouponNotFoundError);
  });

  it("throws CouponNotFoundError for an inactive coupon", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, isActive: false } as never);
    await expect(validateAndComputeDiscount("GULUM100", undefined, 500)).rejects.toThrow(CouponNotFoundError);
  });

  it("throws CouponExpiredError when past endsAt", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, endsAt: new Date("2020-01-01") } as never);
    await expect(validateAndComputeDiscount("GULUM100", undefined, 500)).rejects.toThrow(CouponExpiredError);
  });

  it("throws CouponExpiredError before startsAt", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, startsAt: new Date("2099-01-01") } as never);
    await expect(validateAndComputeDiscount("GULUM100", undefined, 500)).rejects.toThrow(CouponExpiredError);
  });

  it("throws CouponMinOrderError when subtotal is below the minimum", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, minOrderAmount: "300.00" } as never);
    await expect(validateAndComputeDiscount("GULUM100", undefined, 200)).rejects.toThrow(CouponMinOrderError);
  });

  it("throws CouponUsageLimitError when maxUsesTotal is reached", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, maxUsesTotal: 5, usedCount: 5 } as never);
    await expect(validateAndComputeDiscount("GULUM100", undefined, 500)).rejects.toThrow(CouponUsageLimitError);
  });

  it("throws CouponUsageLimitError when this customer already used their allotment", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, maxUsesPerCustomer: 1 } as never);
    vi.mocked(countCustomerRedemptions).mockResolvedValue(1);
    await expect(validateAndComputeDiscount("GULUM100", 42, 500)).rejects.toThrow(CouponUsageLimitError);
  });

  it("computes a fixed discount capped at the subtotal", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, type: "fixed", value: "100.00" } as never);
    const result = await validateAndComputeDiscount("GULUM100", undefined, 50);
    expect(result.discountAmount).toBe(50); // 100 TL'lik kupon 50 TL'lik sepeti aşamaz
  });

  it("computes a percent discount correctly", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, type: "percent", value: "10" } as never);
    const result = await validateAndComputeDiscount("GULUM100", undefined, 500);
    expect(result.discountAmount).toBe(50);
  });

  it("allows a valid coupon within limits for a first-time customer", async () => {
    vi.mocked(findCouponByCode).mockResolvedValue({ ...baseCoupon, maxUsesPerCustomer: 1 } as never);
    vi.mocked(countCustomerRedemptions).mockResolvedValue(0);
    const result = await validateAndComputeDiscount("GULUM100", 42, 500);
    expect(result.discountAmount).toBe(100);
    expect(result.coupon.code).toBe("GULUM100");
  });
});
