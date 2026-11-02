import { FastifyPluginAsync } from "fastify";
import {
  addProductToCollection,
  deleteHomepageCollection,
  homepageCollectionExists,
  insertHomepageCollection,
  listAllHomepageCollections,
  listCollectionProducts,
  removeProductFromCollection,
  updateHomepageCollection,
} from "./admin-homepage-collections.repository";
import {
  addCollectionProductSchema,
  collectionIdParamsSchema,
  collectionProductParamsSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from "./admin-homepage-collections.schemas";

const adminHomepageCollectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/homepage-collections", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllHomepageCollections());
  });

  app.post("/admin/homepage-collections", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createCollectionSchema.parse(request.body);
    const row = await insertHomepageCollection(input);
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
      if (!(await homepageCollectionExists(id))) {
        return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      }
      return reply.send(await listCollectionProducts(id));
    },
  );

  app.post(
    "/admin/homepage-collections/:id/products",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const { productId } = addCollectionProductSchema.parse(request.body);
      const result = await addProductToCollection(id, productId);
      if (result.status === "collection_not_found") return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      if (result.status === "product_not_found") return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      if (result.status === "duplicate") return reply.status(409).send({ error: { message: "Ürün zaten bu koleksiyonda" } });
      return reply.status(201).send(result.row);
    },
  );

  app.delete(
    "/admin/homepage-collections/:id/products/:productId",
    { preHandler: [app.requireAdmin, app.csrfProtection] },
    async (request, reply) => {
      const { id, productId } = collectionProductParamsSchema.parse(request.params);
      if (!(await homepageCollectionExists(id))) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      const removed = await removeProductFromCollection(id, productId);
      if (!removed) return reply.status(404).send({ error: { message: "Ürün bu koleksiyonda bulunamadı" } });
      return reply.send({ ok: true });
    },
  );
};

export default adminHomepageCollectionsRoutes;
