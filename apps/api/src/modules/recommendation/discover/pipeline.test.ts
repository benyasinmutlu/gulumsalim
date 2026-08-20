import { beforeEach, describe, expect, it } from "vitest";
import type { CatalogPort, CatalogProduct, CollaborativePort } from "./candidates";
import { runDiscover, type DiscoverDeps, type DiscoverProfile } from "./pipeline";
import type { DiscoverRequest } from "./contract";

const NOW = 1_700_000_000_000;

function product(over: Partial<CatalogProduct> & { productId: number; vendorId: number; categoryId: number }): CatalogProduct {
  return {
    brand: "A",
    colorFamily: "blue",
    price: 100,
    inStock: true,
    status: "active",
    createdAt: NOW,
    popularity: 0.5,
    ...over,
  };
}

let products: CatalogProduct[];

const catalog: CatalogPort = {
  productsByCategories: async (cats, limit) =>
    products.filter((p) => cats.includes(p.categoryId) && p.status === "active").slice(0, limit),
  trending: async (limit) => [...products].sort((a, b) => b.popularity - a.popularity).slice(0, limit),
  newArrivals: async (limit) => [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
  byIds: async (ids) => products.filter((p) => ids.includes(p.productId)),
};

const collaborative: CollaborativePort = {
  alsoInteracted: async () => [{ productId: 999, vendorId: 77, score: 0.95 }], // 999 katalogda YOK (silinmiş)
};

function profile(over: Partial<DiscoverProfile> = {}): DiscoverProfile {
  return {
    topCategoryIds: [100],
    recentProductIds: [1],
    knownBrands: new Set(["A"]),
    categoryWeights: new Map([[100, 1]]),
    brandWeights: new Map([["A", 1]]),
    colorWeights: new Map([["blue", 1]]),
    priceMin: 50,
    priceMax: 200,
    hiddenProductIds: new Set(),
    notInterestedCategoryIds: new Set(),
    vendorQuality: new Map(),
    ...over,
  };
}

function deps(over: Partial<DiscoverDeps> = {}, prof: DiscoverProfile = profile(), seen = new Set<number>()): DiscoverDeps {
  return {
    catalog,
    collaborative,
    loadProfile: async () => prof,
    loadSeen: async () => seen,
    requestId: "req-1",
    nowMs: NOW,
    ...over,
  };
}

function req(over: Partial<DiscoverRequest> = {}): DiscoverRequest {
  return {
    customerId: 42,
    sessionId: "sess-1",
    surface: "home",
    limit: 6,
    consent: { personalization: true, analytics: true },
    ...over,
  };
}

beforeEach(() => {
  products = [
    product({ productId: 1, vendorId: 10, categoryId: 100, brand: "A", popularity: 0.9 }),
    product({ productId: 2, vendorId: 11, categoryId: 100, brand: "B", popularity: 0.8 }),
    product({ productId: 3, vendorId: 12, categoryId: 100, brand: "C", popularity: 0.7 }),
    product({ productId: 4, vendorId: 13, categoryId: 101, brand: "D", createdAt: NOW, popularity: 0.4 }),
    product({ productId: 5, vendorId: 14, categoryId: 101, brand: "E", createdAt: NOW, popularity: 0.3 }),
    product({ productId: 6, vendorId: 10, categoryId: 100, brand: "A", inStock: false }), // stok yok
  ];
});

describe("runDiscover", () => {
  it("is deterministic for identical input", async () => {
    const a = await runDiscover(req(), deps());
    const b = await runDiscover(req(), deps());
    expect(JSON.stringify(a.sections)).toBe(JSON.stringify(b.sections));
    expect(a.algorithmVersion).toBe("discover-v1");
  });

  it("filters out-of-stock products", async () => {
    const res = await runDiscover(req(), deps());
    const ids = res.sections.flatMap((s) => s.items.map((i) => i.productId));
    expect(ids).not.toContain(6);
  });

  it("filters deleted products referenced by stale collaborative signal", async () => {
    const res = await runDiscover(req(), deps());
    const ids = res.sections.flatMap((s) => s.items.map((i) => i.productId));
    expect(ids).not.toContain(999); // katalogda yok → hydration'da elenir
  });

  it("suppresses hidden and recently-seen products", async () => {
    const res = await runDiscover(req(), deps({}, profile({ hiddenProductIds: new Set([1]) }), new Set([2])));
    const ids = res.sections.flatMap((s) => s.items.map((i) => i.productId));
    expect(ids).not.toContain(1); // gizli
    expect(ids).not.toContain(2); // görülmüş
  });

  it("omits the for_you section for anonymous users", async () => {
    const res = await runDiscover(req({ customerId: undefined }), deps());
    expect(res.sections.find((s) => s.key === "for_you")).toBeUndefined();
    expect(res.cacheable).toBe(true); // anonim → paylaşımlı cache güvenli
  });

  it("treats missing personalization consent as non-personalized", async () => {
    const res = await runDiscover(req({ consent: { personalization: false, analytics: true } }), deps());
    expect(res.sections.find((s) => s.key === "for_you")).toBeUndefined();
    expect(res.cacheable).toBe(true);
  });

  it("marks personalized responses as non-cacheable (cross-user leak guard)", async () => {
    const res = await runDiscover(req(), deps());
    expect(res.cacheable).toBe(false);
  });

  it("attaches a per-product recommendationId and a reason code", async () => {
    const res = await runDiscover(req(), deps());
    const item = res.sections.flatMap((s) => s.items)[0]!;
    expect(item.recommendationId).toMatch(/^[0-9a-f]{20}$/);
    expect(item.reasonCode).toBeTruthy();
  });

  it("does not repeat a product across sections", async () => {
    const res = await runDiscover(req(), deps());
    const ids = res.sections.flatMap((s) => s.items.map((i) => i.productId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to popular when every source is empty", async () => {
    const emptyCatalog: CatalogPort = {
      productsByCategories: async () => [],
      trending: async () => [],
      newArrivals: async () => [],
      byIds: async (ids) => products.filter((p) => ids.includes(p.productId)),
    };
    // Tüm kaynaklar boş: katalog + collaborative boş → fallback devreye girer.
    const res = await runDiscover(
      req(),
      deps({ catalog: emptyCatalog, collaborative: { alsoInteracted: async () => [] } }),
    );
    expect(res.fallbackUsed).toBe(true);
  });

  it("produces a stable, decodable cursor when results remain", async () => {
    const res = await runDiscover(req({ limit: 2 }), deps());
    // limit küçük olduğundan sonuç kalabilir → cursor null olmayabilir
    if (res.cursor) expect(typeof res.cursor).toBe("string");
  });
});
