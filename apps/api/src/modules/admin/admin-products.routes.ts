import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deleteObject } from "../../lib/storage";
import { findProductsByIds } from "../catalog/catalog.repository";
import { removeProductFromIndex, syncProductToIndex } from "../catalog/search-index.service";
import { recordAdminAction } from "./admin-audit.repository";
import { countProductsByStatus, deleteProduct, listAllProducts, ProductHasOrdersError, updateProductStatus } from "./admin-products.repository";
import { productIdParamsSchema, productListQuerySchema, updateProductStatusSchema } from "./admin-products.schemas";
import { assertProductReadyForPublication, ProductNotReadyError } from "../catalog/product-readiness.repository";

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
    if (status === "active") {
      try {
        await assertProductReadyForPublication(id);
      } catch (err) {
        if (err instanceof ProductNotReadyError) {
          return reply.status(400).send({ error: { code: "product_incomplete", message: err.message, details: { issues: err.issues } } });
        }
        throw err;
      }
    }
    const row = await updateProductStatus(id, status);
    if (!row) return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    recordAdminAction(request.session.adminId!, status, "product", id, `"${row.name}" ürününün durumu "${status}" olarak değiştirildi`).catch(() => {});
    syncProductToIndex(id).catch(() => {});
    return reply.send(row);
  });

  app.delete("/admin/products/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = productIdParamsSchema.parse(request.params);
    try {
      const result = await deleteProduct(id);
      if (result.status === "not_found") return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      if (result.status !== "deleted") throw new Error("Beklenmeyen ürün silme sonucu");
      removeProductFromIndex(id).catch(() => {});
      for (const url of result.mediaUrls) deleteObject(url).catch(() => {});
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof ProductHasOrdersError) {
        return reply.status(409).send({ error: { message: "Bu ürünün sipariş geçmişi var, kalıcı olarak silinemez. Bunun yerine pasife alabilirsiniz." } });
      }
      throw err;
    }
  });
};

export default adminProductsRoutes;
