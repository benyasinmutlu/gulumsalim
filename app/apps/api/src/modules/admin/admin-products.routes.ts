import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { findProductsByIds } from "../catalog/catalog.repository";
import { removeProductFromIndex, syncProductToIndex } from "../catalog/search-index.service";
import { countProductsByStatus, deleteProduct, listAllProducts, updateProductStatus } from "./admin-products.repository";
import { productIdParamsSchema, productListQuerySchema, updateProductStatusSchema } from "./admin-products.schemas";

const byIdsQuerySchema = z.object({ ids: z.string().min(1) });

const adminProductsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/products", { preHandler: app.requireAdmin }, async (request, reply) => {
    const query = productListQuerySchema.parse(request.query);
    const [items, counts] = await Promise.all([listAllProducts(query), countProductsByStatus()]);
    return reply.send({ items, counts });
  });

  // Anasayfa Bölümleri'ndeki ürün sabitleme/hariç tutma seçicisinin,
  // daha önce kaydedilmiş ID listesi için ürün adlarını göstermesi için.
  app.get("/admin/products/by-ids", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { ids } = byIdsQuerySchema.parse(request.query);
    const idList = ids.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return reply.send(await findProductsByIds(idList));
  });

  app.patch("/admin/products/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const { status } = updateProductStatusSchema.parse(request.body);
    const row = await updateProductStatus(id, status);
    if (!row) return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    syncProductToIndex(id).catch(() => {});
    return reply.send(row);
  });

  app.delete("/admin/products/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    const deleted = await deleteProduct(id);
    if (!deleted) return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    removeProductFromIndex(id).catch(() => {});
    return reply.send({ ok: true });
  });
};

export default adminProductsRoutes;
