import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findVendorById: vi.fn(),
  getBulkImportQueue: vi.fn(),
}));

vi.mock("./vendor.repository", () => ({ findVendorById: mocks.findVendorById }));
vi.mock("../../lib/queue/queues", () => ({ getBulkImportQueue: mocks.getBulkImportQueue }));

import vendorBulkImportRoutes from "./vendor-bulk-import.routes";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate("requireVendor", async () => undefined);
  app.decorate("csrfProtection", async () => undefined);
  app.addHook("onRequest", (request, _reply, done) => {
    (request as unknown as { session: { vendorId: number } }).session = { vendorId: 7 };
    done();
  });
  await app.register(vendorBulkImportRoutes);
  await app.ready();
  return app;
}

describe("bulk import membership boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an individual vendor even when the hidden endpoint is called directly", async () => {
    mocks.findVendorById.mockResolvedValue({ id: 7, vendorType: "individual" });
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: `/vendor/products/bulk-import/status/bulk-7-${"a".repeat(64)}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: { message: "Toplu ürün yükleme yalnız kurumsal üyeler içindir" } });
    expect(mocks.getBulkImportQueue).not.toHaveBeenCalled();
    await app.close();
  });
});
