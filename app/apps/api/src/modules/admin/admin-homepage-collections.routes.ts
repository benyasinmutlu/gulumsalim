import { FastifyPluginAsync } from "fastify";
import {
  addProductToCollection,
  deleteHomepageCollection,
  insertHomepageCollection,
  listAllHomepageCollections,
  listCollectionProducts,
  removeProductFromCollection,
  updateHomepageCollection,
} from "./admin-homepage-collections.repository";
import {
  addCollectionProductSchema,
  collectionIdParamsSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from "./admin-homepage-collections.schemas";

const adminHomepageCollectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/homepage-collections", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllHomepageCollections());
  });

  app.post("/admin/homepage-collections", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createCollectionSchema.parse(request.body);
    const existing = await listAllHomepageCollections();
    const row = await insertHomepageCollection({ ...input, sortOrder: existing.length });
    return reply.status(201).send(row);
  });

  app.patch(
    "/admin/homepage-collections/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const input = updateCollectionSchema.parse(request.body);
      const row = await updateHomepageCollection(id, input);
      if (!row) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      return reply.send(row);
    },
  );

  app.delete(
    "/admin/homepage-collections/:id",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const deleted = await deleteHomepageCollection(id);
      if (!deleted) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  app.get(
    "/admin/homepage-collections/:id/products",
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      return reply.send(await listCollectionProducts(id));
    },
  );

  app.post(
    "/admin/homepage-collections/:id/products",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const { productId } = addCollectionProductSchema.parse(request.body);
      const existing = await listCollectionProducts(id);
      const row = await addProductToCollection(id, productId, existing.length);
      if (!row) return reply.status(409).send({ error: { message: "Ürün zaten bu koleksiyonda" } });
      return reply.status(201).send(row);
    },
  );

  app.delete(
    "/admin/homepage-collections/:id/products/:productId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const { productId } = request.params as { productId: string };
      await removeProductFromCollection(id, Number(productId));
      return reply.send({ ok: true });
    },
  );
};

export default adminHomepageCollectionsRoutes;
