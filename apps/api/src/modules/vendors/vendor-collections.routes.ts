import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  addProductToCollection,
  createCollection,
  deleteCollection,
  findVendorCollection,
  listCollectionProducts,
  listVendorCollections,
  removeProductFromCollection,
  swapCollectionProductOrder,
  updateCollection,
  updateCollectionImage,
} from "./vendor-collections.repository";
import {
  addCollectionProductSchema,
  collectionIdParamsSchema,
  createCollectionSchema,
  moveCollectionProductSchema,
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

  // vendor/collections.php'deki "Kapak Görseli" alanının karşılığı -
  // önceki denetimde bu uç nokta hiç yoktu (bkz. kullanıcı geri bildirimi:
  // "koleksiyon resmini seçemiyorum").
  app.post(
    "/vendor/collections/:id/image",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const collection = await findVendorCollection(request.session.vendorId!, id);
      if (!collection) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
      const buffer = await file.toBuffer();
      try {
        const image = await saveImage(`collections/${request.session.vendorId}`, buffer, file.mimetype);
        const row = await updateCollectionImage(request.session.vendorId!, id, image);
        return reply.send(row);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply.status(400).send({ error: { message: err.message } });
        }
        throw err;
      }
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

  // bkz. kullanıcı isteği: "hangi ürünler olacak vs vs gibi bir çok
  // detay olmalı" - koleksiyon vitrinindeki ürün sırası artık satıcı
  // tarafından değiştirilebilir.
  app.post(
    "/vendor/collections/:id/products/:productId/move",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = collectionIdParamsSchema.parse(request.params);
      const collection = await findVendorCollection(request.session.vendorId!, id);
      if (!collection) return reply.status(404).send({ error: { message: "Koleksiyon bulunamadı" } });
      const { productId } = request.params as { productId: string };
      const { direction } = moveCollectionProductSchema.parse(request.body);

      const items = await listCollectionProducts(id);
      const idx = items.findIndex((p) => p.productId === Number(productId));
      if (idx === -1) return reply.status(404).send({ error: { message: "Ürün bu koleksiyonda bulunamadı" } });

      const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
      if (neighborIdx >= 0 && neighborIdx < items.length) {
        const current = items[idx]!;
        const neighbor = items[neighborIdx]!;
        await swapCollectionProductOrder(id, current.productId, current.sortOrder, neighbor.productId, neighbor.sortOrder);
      }
      return reply.send(await listCollectionProducts(id));
    },
  );
};

export default vendorCollectionsRoutes;
