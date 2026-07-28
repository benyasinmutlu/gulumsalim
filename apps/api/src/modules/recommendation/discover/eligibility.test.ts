import { describe, expect, it } from "vitest";
import { isEligibleForDiscoverV1, parseDiscoverFlags } from "./eligibility";

const flags = (over: Partial<ReturnType<typeof parseDiscoverFlags>> = {}) => ({
  enabled: true,
  rolloutPercent: 0,
  customerAllowlist: new Set<number>(),
  anonymousEnabled: false,
  ...over,
});

describe("parseDiscoverFlags", () => {
  it("defaults to disabled/empty when env is unset", () => {
    const f = parseDiscoverFlags({});
    expect(f.enabled).toBe(false);
    expect(f.rolloutPercent).toBe(0);
    expect(f.customerAllowlist.size).toBe(0);
    expect(f.anonymousEnabled).toBe(false);
  });
  it("parses a bounded, integer-only allowlist and clamps percent", () => {
    const f = parseDiscoverFlags({
      DISCOVER_V1_ENABLED: "true",
      DISCOVER_V1_CUSTOMER_ALLOWLIST: "1, 2 ,x,-3, 4",
      DISCOVER_V1_ROLLOUT_PERCENT: "250",
      DISCOVER_V1_ANONYMOUS_ENABLED: "true",
    });
    expect([...f.customerAllowlist].sort()).toEqual([1, 2, 4]);
    expect(f.rolloutPercent).toBe(100);
    expect(f.enabled).toBe(true);
    expect(f.anonymousEnabled).toBe(true);
  });
});

describe("isEligibleForDiscoverV1", () => {
  it("is never eligible when globally disabled (kill switch)", () => {
    expect(isEligibleForDiscoverV1({ customerId: 5, stableId: "c:5" }, flags({ enabled: false, rolloutPercent: 100 }))).toBe(false);
  });
  it("allows an allowlisted customer regardless of rollout percent", () => {
    expect(isEligibleForDiscoverV1({ customerId: 7, stableId: "c:7" }, flags({ customerAllowlist: new Set([7]) }))).toBe(true);
  });
  it("blocks anonymous when anonymous rollout is off", () => {
    expect(isEligibleForDiscoverV1({ stableId: "s:abc" }, flags({ rolloutPercent: 100, anonymousEnabled: false }))).toBe(false);
  });
  it("allows anonymous at 100% when anonymous rollout is on", () => {
    expect(isEligibleForDiscoverV1({ stableId: "s:abc" }, flags({ rolloutPercent: 100, anonymousEnabled: true }))).toBe(true);
  });
  it("blocks everyone at 0% (unless allowlisted)", () => {
    expect(isEligibleForDiscoverV1({ customerId: 9, stableId: "c:9" }, flags({ rolloutPercent: 0 }))).toBe(false);
  });
  it("is deterministic and monotonic across rollout percents", () => {
    const id = { customerId: 42, stableId: "c:42" };
    const a = isEligibleForDiscoverV1(id, flags({ rolloutPercent: 50 }));
    const b = isEligibleForDiscoverV1(id, flags({ rolloutPercent: 50 }));
    expect(a).toBe(b); // stabil
    // 100% herkesi kapsar → 50%'de eligible ise 100%'de de eligible olmalı
    expect(isEligibleForDiscoverV1(id, flags({ rolloutPercent: 100 }))).toBe(true);
  });
  it("approximates the target percentage across a population", () => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (isEligibleForDiscoverV1({ customerId: i, stableId: `c:${i}` }, flags({ rolloutPercent: 25 }))) n++;
    }
    expect(n).toBeGreaterThan(60); // ~100 beklenir; geniş tolerans
    expect(n).toBeLessThan(140);
  });
});
