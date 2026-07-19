import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveProductImage } from "./image-upload.service";
import {
  deleteProductImageById,
  deleteVendorProduct,
  findProductBySlugAnyVendor,
  findProductImageOwnedByVendor,
  findVendorProduct,
  insertProductImage,
  insertVendorProduct,
  listProductImages,
  listVendorProducts,
  updateVendorProduct,
} from "./vendor-products.repository";
import { createProductSchema, productIdParamsSchema, productImageParamsSchema, updateProductSchema } from "./vendor-products.schemas";

const vendorProductsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/products", { preHandler: app.requireVendor }, async (request, reply) => {
    reply.send(await listVendorProducts(request.session.vendorId!));
  });

  app.post("/vendor/products", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = createProductSchema.parse(request.body);
    const existingSlug = await findProductBySlugAnyVendor(input.slug);
    if (existingSlug) {
      reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
      return;
    }

    const product = await insertVendorProduct(request.session.vendorId!, {
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      basePrice: input.basePrice.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
    });
    reply.status(201).send(product);
  });

  app.patch("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const input = updateProductSchema.parse(request.body);

    if (input.slug) {
      const existingSlug = await findProductBySlugAnyVendor(input.slug);
      if (existingSlug && existingSlug.id !== id) {
        reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
        return;
      }
    }

    const updated = await updateVendorProduct(request.session.vendorId!, id, {
      ...input,
      basePrice: input.basePrice?.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
    });
    if (!updated) {
      reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      return;
    }
    reply.send(updated);
  });

  app.delete("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const deleted = await deleteVendorProduct(request.session.vendorId!, id);
    if (!deleted) {
      reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      return;
    }
    reply.send({ ok: true });
  });

  app.get("/vendor/products/:id/images", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      return;
    }
    reply.send(await listProductImages(id));
  });

  app.post("/vendor/products/:id/images", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      return;
    }

    const file = await request.file();
    if (!file) {
      reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
      return;
    }
    const buffer = await file.toBuffer();

    try {
      const url = await saveProductImage(request.session.vendorId!, buffer, file.mimetype);
      const existingImages = await listProductImages(id);
      const image = await insertProductImage(id, url, existingImages.length === 0, existingImages.length);
      reply.status(201).send(image);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        reply.status(400).send({ error: { message: err.message } });
        return;
      }
      throw err;
    }
  });

  app.delete(
    "/vendor/products/:id/images/:imageId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { imageId } = productImageParamsSchema.parse(request.params);
      const image = await findProductImageOwnedByVendor(request.session.vendorId!, imageId);
      if (!image) {
        reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
        return;
      }
      await deleteProductImageById(image.id);
      reply.send({ ok: true });
    },
  );
};

export default vendorProductsRoutes;
