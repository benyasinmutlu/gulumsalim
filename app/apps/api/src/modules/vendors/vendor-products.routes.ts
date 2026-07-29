import { FastifyPluginAsync } from "fastify";
import { removeProductFromIndex, syncProductToIndex } from "../catalog/search-index.service";
import { InvalidImageError, saveProductImage } from "./image-upload.service";
import { getCartCounts } from "../../lib/cart-product-index";
import {
  deleteProductImageById,
  deleteProductVariant,
  deleteVendorProduct,
  findProductBySlugAnyVendor,
  findProductImageOwnedByVendor,
  findVariantOwnedByVendor,
  findVendorProduct,
  insertProductImage,
  insertProductVariant,
  insertVendorProduct,
  listProductImages,
  listProductVariants,
  listVendorProducts,
  setPrimaryProductImage,
  updateProductVariant,
  updateVendorProduct,
} from "./vendor-products.repository";
import {
  createProductSchema,
  createVariantSchema,
  productIdParamsSchema,
  productImageParamsSchema,
  productListQuerySchema,
  productVariantParamsSchema,
  updateProductSchema,
  updateVariantSchema,
} from "./vendor-products.schemas";
import { computeProductStats } from "./vendor-products.stats";

const vendorProductsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/products", { preHandler: app.requireVendor }, async (request, reply) => {
    const filter = productListQuerySchema.parse(request.query);
    const rows = await listVendorProducts(request.session.vendorId!, filter);
    const cartCounts = await getCartCounts(app.redis, rows.map((r) => r.id));
    return reply.send(rows.map((r) => ({ ...r, cartCount: cartCounts.get(r.id) ?? 0 })));
  });

  // bkz. kullanıcı isteği: "analiz" - özet her zaman filtrelenmemiş tüm
  // ürünler üzerinden. Statik yol, ":id" param rotasından önce eşleşir.
  app.get("/vendor/products/stats", { preHandler: app.requireVendor }, async (request, reply) => {
    const rows = await listVendorProducts(request.session.vendorId!);
    return reply.send(computeProductStats(rows));
  });

  app.post("/vendor/products", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = createProductSchema.parse(request.body);
    const existingSlug = await findProductBySlugAnyVendor(input.slug);
    if (existingSlug) {
      return reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
    }

    const product = await insertVendorProduct(request.session.vendorId!, {
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      brand: input.brand,
      basePrice: input.basePrice.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
      isSecondHand: input.isSecondHand,
    });
    syncProductToIndex(product.id).catch(() => {});
    return reply.status(201).send(product);
  });

  app.patch("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const input = updateProductSchema.parse(request.body);

    if (input.slug) {
      const existingSlug = await findProductBySlugAnyVendor(input.slug);
      if (existingSlug && existingSlug.id !== id) {
        return reply.status(409).send({ error: { message: "Bu ürün adresi zaten kullanılıyor" } });
      }
    }

    const updated = await updateVendorProduct(request.session.vendorId!, id, {
      ...input,
      basePrice: input.basePrice?.toFixed(2),
      compareAtPrice: input.compareAtPrice?.toFixed(2),
    });
    if (!updated) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    syncProductToIndex(id).catch(() => {});
    return reply.send(updated);
  });

  app.delete("/vendor/products/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const deleted = await deleteVendorProduct(request.session.vendorId!, id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    removeProductFromIndex(id).catch(() => {});
    return reply.send({ ok: true });
  });

  app.get("/vendor/products/:id/images", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    return reply.send(await listProductImages(id));
  });

  app.post("/vendor/products/:id/images", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Dosya bulunamadı" } });
    }
    const buffer = await file.toBuffer();

    try {
      const url = await saveProductImage(request.session.vendorId!, buffer, file.mimetype);
      const existingImages = await listProductImages(id);
      const image = await insertProductImage(id, url, existingImages.length === 0, existingImages.length);
      return reply.status(201).send(image);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
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
        return reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
      }
      await deleteProductImageById(image.id);
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/vendor/products/:id/images/:imageId/primary",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, imageId } = productImageParamsSchema.parse(request.params);
      const image = await findProductImageOwnedByVendor(request.session.vendorId!, imageId);
      if (!image) {
        return reply.status(404).send({ error: { message: "Görsel bulunamadı" } });
      }
      await setPrimaryProductImage(id, imageId);
      return reply.send({ ok: true });
    },
  );

  app.get("/vendor/products/:id/variants", { preHandler: app.requireVendor }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    return reply.send(await listProductVariants(id));
  });

  app.post("/vendor/products/:id/variants", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const product = await findVendorProduct(request.session.vendorId!, id);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const input = createVariantSchema.parse(request.body);
    const variant = await insertProductVariant(id, {
      sku: input.sku,
      size: input.size,
      color: input.color,
      priceOverride: input.priceOverride?.toFixed(2),
      stock: input.stock,
    });
    syncProductToIndex(id).catch(() => {});
    return reply.status(201).send(variant);
  });

  app.patch(
    "/vendor/products/:id/variants/:variantId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, variantId } = productVariantParamsSchema.parse(request.params);
      const owned = await findVariantOwnedByVendor(request.session.vendorId!, variantId);
      if (!owned) {
        return reply.status(404).send({ error: { message: "Varyant bulunamadı" } });
      }
      const input = updateVariantSchema.parse(request.body);
      const updated = await updateProductVariant(variantId, {
        ...input,
        priceOverride: input.priceOverride?.toFixed(2),
      });
      syncProductToIndex(id).catch(() => {});
      return reply.send(updated);
    },
  );

  app.delete(
    "/vendor/products/:id/variants/:variantId",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id, variantId } = productVariantParamsSchema.parse(request.params);
      const owned = await findVariantOwnedByVendor(request.session.vendorId!, variantId);
      if (!owned) {
        return reply.status(404).send({ error: { message: "Varyant bulunamadı" } });
      }
      await deleteProductVariant(variantId);
      syncProductToIndex(id).catch(() => {});
      return reply.send({ ok: true });
    },
  );
};

export default vendorProductsRoutes;
