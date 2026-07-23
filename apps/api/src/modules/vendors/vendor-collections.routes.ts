import { FastifyPluginAsync } from "fastify";
import {
  addProductToCollection,
  createCollection,
  deleteCollection,
  findVendorCollection,
  listCollectionProducts,
  listVendorCollections,
  removeProductFromCollection,
  updateCollection,
} from "./vendor-collections.repository";
import {
  addCollectionProductSchema,
  collectionIdParamsSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from "./vendor-collections.schemas";

const vendorCollectionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/collections", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorCollections(request.session.vendorId!));
  });

  app.post("/vendor/collections", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = createCollectionSchema.parse(request.body);
    return reply.status(201).send(await createCollection(request.session.vendorId!, input));
  });

  app.patch(
    "/vendor/collections/:id",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const input = updateCollectionSchema.parse(request.body);
      const row = await updateCollection(request.session.vendorId!, id, input);
      if (!row) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      return reply.send(row);
    },
  );

  app.delete(
    "/vendor/collections/:id",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const deleted = await deleteCollection(request.session.vendorId!, id);
      if (!deleted) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  app.get(
    "/vendor/collections/:id/products",
    { preHandler: app.requireVendor },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const collection = await findVendorCollection(request.session.vendorId!, id);
      if (!collection) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      return reply.send(await listCollectionProducts(id));
    },
  );

  app.post(
    "/vendor/collections/:id/products",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const collection = await findVendorCollection(request.session.vendorId!, id);
      if (!collection) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      const { productId, sortOrder } = addCollectionProductSchema.parse(request.body);
      const row = await addProductToCollection(id, productId, sortOrder);
      return reply.status(201).send(row);
    },
  );

  app.delete(
    "/vendor/collections/:id/products/:productId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const collection = await findVendorCollection(request.session.vendorId!, id);
      if (!collection) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      const { productId } = request.params as { productId: string };
      await removeProductFromCollection(id, Number(productId));
      return reply.send({ ok: true });
    },
  );
};

export default vendorCollectionsRoutes;
