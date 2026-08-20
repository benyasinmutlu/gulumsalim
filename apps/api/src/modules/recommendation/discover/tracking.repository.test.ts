import { describe, expect, it } from "vitest";
import { computeCtr, toDiscoverEventRow } from "./tracking.repository";
import type { TrustedEvent } from "./event-security";

const base: TrustedEvent = {
  type: "click",
  customerId: 7,
  sessionId: "s-1",
  productId: 42,
  vendorId: 3,
  categoryId: 100,
  occurredAt: 1_700_000_000_000,
  source: "collaborative",
  dedupKey: "dk-abc",
  writeProfile: true,
};

describe("toDiscoverEventRow", () => {
  it("TrustedEvent alanlarını satıra map'ler", () => {
    const r = toDiscoverEventRow(base);
    expect(r.type).toBe("click");
    expect(r.customerId).toBe(7);
    expect(r.productId).toBe(42);
    expect(r.source).toBe("collaborative");
    expect(r.dedupKey).toBe("dk-abc");
    expect(r.occurredAt).toBeInstanceOf(Date);
    expect(r.occurredAt.getTime()).toBe(1_700_000_000_000);
  });

  it("anonim (customerId yok) → null", () => {
    const r = toDiscoverEventRow({ ...base, customerId: undefined, productId: undefined });
    expect(r.customerId).toBeNull();
    expect(r.productId).toBeNull();
    expect(r.sessionId).toBe("s-1");
  });
});

describe("computeCtr", () => {
  it("kaynak başına CTR = tıklama/gösterim", () => {
    const rep = computeCtr([
      { source: "collaborative", impressions: 100, clicks: 20 },
      { source: "trending", impressions: 50, clicks: 5 },
    ]);
    expect(rep.bySource[0]!.source).toBe("collaborative"); // gösterim DESC
    expect(rep.bySource[0]!.ctr).toBeCloseTo(0.2, 5);
    expect(rep.bySource[1]!.ctr).toBeCloseTo(0.1, 5);
  });

  it("overall toplamları birleştirir", () => {
    const rep = computeCtr([
      { source: "a", impressions: 100, clicks: 20 },
      { source: "b", impressions: 100, clicks: 10 },
    ]);
    expect(rep.overall.impressions).toBe(200);
    expect(rep.overall.clicks).toBe(30);
    expect(rep.overall.ctr).toBeCloseTo(0.15, 5);
  });

  it("gösterim 0 → CTR 0 (bölme hatası yok)", () => {
    const rep = computeCtr([{ source: "x", impressions: 0, clicks: 0 }]);
    expect(rep.bySource[0]!.ctr).toBe(0);
    expect(rep.overall.ctr).toBe(0);
  });

  it("boş → sıfır rapor", () => {
    const rep = computeCtr([]);
    expect(rep.bySource).toEqual([]);
    expect(rep.overall).toEqual({ source: "ALL", impressions: 0, clicks: 0, ctr: 0 });
  });
});
