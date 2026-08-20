import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositories = vi.hoisted(() => ({
  findVendorCollection: vi.fn(),
  findVendorProduct: vi.fn(),
  addProductToCollection: vi.fn(),
}));

vi.mock("./vendor-collections.repository", () => ({
  addProductToCollection: repositories.addProductToCollection,
  createCollection: vi.fn(),
  deleteCollection: vi.fn(),
  findVendorCollection: repositories.findVendorCollection,
  listCollectionProducts: vi.fn(),
  listVendorCollections: vi.fn(),
  removeProductFromCollection: vi.fn(),
  swapCollectionProductOrder: vi.fn(),
  updateCollection: vi.fn(),
  updateCollectionImage: vi.fn(),
}));

vi.mock("./vendor-products.repository", () => ({
  findVendorProduct: repositories.findVendorProduct,
}));

import vendorCollectionsRoutes from "./vendor-collections.routes";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate("requireVendor", async () => undefined);
  app.decorate("csrfProtection", async () => undefined);
  app.addHook("onRequest", (request, _reply, done) => {
    (request as unknown as { session: { vendorId: number } }).session = { vendorId: 7 };
    done();
  });
  await app.register(vendorCollectionsRoutes);
  await app.ready();
  return app;
}

describe("POST /vendor/collections/:id/products tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositories.findVendorCollection.mockResolvedValue({ id: 44, vendorId: 7 });
  });

  it("rejects a product that is not owned by the signed-in vendor", async () => {
    repositories.findVendorProduct.mockResolvedValue(null);
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/vendor/collections/44/products",
      payload: { productId: 99 },
    });

    expect(response.statusCode).toBe(404);
    expect(repositories.findVendorProduct).toHaveBeenCalledWith(7, 99);
    expect(repositories.addProductToCollection).not.toHaveBeenCalled();
    await app.close();
  });

  it("adds a product after both collection and product ownership are verified", async () => {
    repositories.findVendorProduct.mockResolvedValue({ id: 99, vendorId: 7 });
    repositories.addProductToCollection.mockResolvedValue({ id: 123, collectionId: 44, productId: 99 });
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      url: "/vendor/collections/44/products",
      payload: { productId: 99, sortOrder: 2 },
    });

    expect(response.statusCode).toBe(201);
    expect(repositories.addProductToCollection).toHaveBeenCalledWith(44, 99, 2);
    await app.close();
  });
});
