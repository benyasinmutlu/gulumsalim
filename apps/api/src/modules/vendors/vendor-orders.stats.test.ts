import { describe, expect, it } from "vitest";
import { computeOrderStats, type OrderStatsInput } from "./vendor-orders.stats";

const row = (vendorStatus: string, total = "0"): OrderStatsInput => ({ vendorStatus, total });

describe("computeOrderStats", () => {
  it("returns zeros for an empty list", () => {
    expect(computeOrderStats([])).toEqual({
      total: 0,
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      revenue: 0,
    });
  });

  it("counts each status and sums revenue from delivered items only", () => {
    const s = computeOrderStats([
      row("pending", "100"),
      row("processing", "50"),
      row("shipped", "75"),
      row("delivered", "200"),
      row("delivered", "30.50"),
      row("cancelled", "999"),
    ]);
    expect(s.total).toBe(6);
    expect(s.pending).toBe(1);
    expect(s.processing).toBe(1);
    expect(s.shipped).toBe(1);
    expect(s.delivered).toBe(2);
    expect(s.cancelled).toBe(1);
    // ciro yalnız teslim edilenlerden (iptal/kargodaki dahil değil)
    expect(s.revenue).toBeCloseTo(230.5);
  });

  it("ignores an unknown status without inflating counts or revenue", () => {
    const s = computeOrderStats([row("weird", "10")]);
    expect(s.total).toBe(1);
    expect(s.revenue).toBe(0);
  });
});
