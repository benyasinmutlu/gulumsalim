import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import type { CatalogPort, CatalogProduct } from "./candidates";
import discoverV1Routes from "./discover.v1.routes";
import {
  deterministicExperiment,
  inMemoryProfileAdapter,
  inMemorySeenAdapter,
  type DiscoverRuntime,
  type LegacyRecommendationAdapter,
} from "./runtime";

const NOW = 1_700_000_000_000;

function product(id: number, vendorId: number, categoryId: number, over: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    productId: id,
    vendorId,
    categoryId,
    brand: `brand-${vendorId}`,
    colorFamily: "blue",
    price: 100,
    inStock: true,
    status: "active",
    createdAt: NOW,
    popularity: 0.5,
    ...over,
  };
}

const data: CatalogProduct[] = [
  product(1, 10, 100, { popularity: 0.9 }),
  product(2, 11, 100, { popularity: 0.8 }),
  product(3, 12, 101, { popularity: 0.7 }),
  product(4, 13, 101, { createdAt: NOW + 1000 }),
];

const catalog: CatalogPort = {
  byIds: async (ids) => data.filter((p) => ids.includes(p.productId)),
  productsByCategories: async (cats, limit) => data.filter((p) => cats.includes(p.categoryId)).slice(0, limit),
  trending: async (limit) => [...data].sort((a, b) => b.popularity - a.popularity).slice(0, limit),
  newArrivals: async (limit) => [...data].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit),
};

function buildRuntime(over: Partial<DiscoverRuntime> = {}): DiscoverRuntime {
  const legacy: LegacyRecommendationAdapter = { personalizedProductIds: async (cid) => (cid ? [1, 2] : []) };
  return {
    catalog,
    collaborative: { alsoInteracted: async () => [] },
    legacy,
    profile: inMemoryProfileAdapter(),
    seen: inMemorySeenAdapter(),
    experiment: deterministicExperiment(),
    generateRequestId: () => "req-test",
    nowMs: NOW,
    ...over,
  };
}

async function buildApp(
  session: { customerId?: number; sessionId?: string } | undefined,
  runtime: DiscoverRuntime = buildRuntime(),
): Promise<FastifyInstance> {
  const app = Fastify();
  app.addHook("preHandler", (req, _reply, done) => {
    (req as unknown as { session: typeof session }).session = session;
    done();
  });
  await app.register(discoverV1Routes, { runtime });
  await app.ready();
  return app;
}

describe("GET /v1/discover", () => {
  it("serves a personalized, non-cacheable response for an authenticated session", async () => {
    const app = await buildApp({ customerId: 42, sessionId: "s1" });
    const res = await app.inject({ method: "GET", url: "/v1/discover" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.algorithmVersion).toBe("discover-v1");
    expect(body.cacheable).toBe(false);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(body.sections.length).toBeGreaterThan(0);
    expect(body.treatment).toMatch(/control|treatment/);
    await app.close();
  });

  it("serves a cacheable feed with no for_you section for anonymous sessions", async () => {
    const app = await buildApp({ sessionId: "anon-1" });
    const res = await app.inject({ method: "GET", url: "/v1/discover" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cacheable).toBe(true);
    expect(res.headers["cache-control"]).toContain("public");
    expect(body.sections.find((s: { key: string }) => s.key === "for_you")).toBeUndefined();
    await app.close();
  });

  it("ignores a client-supplied customerId in the query (identity from session only)", async () => {
    const app = await buildApp({ sessionId: "anon-1" }); // anonim session
    const res = await app.inject({ method: "GET", url: "/v1/discover?customerId=999" });
    const body = res.json();
    // Query'deki customerId yok sayılır → hâlâ anonim (cacheable) davranır.
    expect(body.cacheable).toBe(true);
    await app.close();
  });

  it("rejects invalid and out-of-range limits", async () => {
    const app = await buildApp({ customerId: 1, sessionId: "s1" });
    expect((await app.inject({ method: "GET", url: "/v1/discover?limit=0" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/v1/discover?limit=999" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/v1/discover?limit=50" })).statusCode).toBe(200);
    await app.close();
  });

  it("tolerates a tampered cursor (fail-safe to offset 0)", async () => {
    const app = await buildApp({ customerId: 1, sessionId: "s1" });
    const res = await app.inject({ method: "GET", url: "/v1/discover?cursor=not-a-real-cursor" });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("filters deleted products returned by a stale legacy feed", async () => {
    const runtime = buildRuntime({ legacy: { personalizedProductIds: async () => [999, 1] } }); // 999 katalogda yok
    const app = await buildApp({ customerId: 42, sessionId: "s1" }, runtime);
    const body = (await app.inject({ method: "GET", url: "/v1/discover" })).json();
    const ids = body.sections.flatMap((s: { items: { productId: number }[] }) => s.items.map((i) => i.productId));
    expect(ids).not.toContain(999);
    await app.close();
  });

  it("isolates a failing legacy source and still serves trending", async () => {
    const runtime = buildRuntime({
      legacy: { personalizedProductIds: async () => { throw new Error("go down"); } },
    });
    const app = await buildApp({ customerId: 42, sessionId: "s1" }, runtime);
    const res = await app.inject({ method: "GET", url: "/v1/discover" });
    expect(res.statusCode).toBe(200);
    expect(res.json().sections.length).toBeGreaterThan(0);
    await app.close();
  });

  it("assigns a stable experiment variant across repeated calls", async () => {
    const app = await buildApp({ customerId: 42, sessionId: "s1" });
    const a = (await app.inject({ method: "GET", url: "/v1/discover" })).json();
    const b = (await app.inject({ method: "GET", url: "/v1/discover" })).json();
    expect(a.treatment).toBe(b.treatment);
    await app.close();
  });

  it("does not repeat a product across sections and exposes recommendationId + reasonCode", async () => {
    const app = await buildApp({ customerId: 42, sessionId: "s1" });
    const body = (await app.inject({ method: "GET", url: "/v1/discover" })).json();
    const items = body.sections.flatMap((s: { items: { productId: number; recommendationId: string; reasonCode: string }[] }) => s.items);
    const ids = items.map((i: { productId: number }) => i.productId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of items) {
      expect(it.recommendationId).toMatch(/^[0-9a-f]{20}$/);
      expect(it.reasonCode).toBeTruthy();
    }
    // Public yanıtta iç scoring ağırlıkları / profil vektörü sızmamalı.
    expect(JSON.stringify(body)).not.toContain("categoryAffinity");
    expect(JSON.stringify(body)).not.toContain("weight");
    await app.close();
  });
});
