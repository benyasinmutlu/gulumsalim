import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  CategoryHasChildrenError,
  CategoryHasProductsError,
  createCategory,
  deleteCategoryIfEmpty,
  listCategoriesWithCounts,
  updateCategory,
  updateCategoryImage,
} from "./admin-categories.repository";
import { categoryIdParamsSchema, createCategorySchema, updateCategorySchema } from "./admin-categories.schemas";

const adminCategoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/categories", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listCategoriesWithCounts());
  });

  app.post("/admin/categories", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = createCategorySchema.parse(request.body);
    return reply.status(201).send(await createCategory(input));
  });

  app.patch("/admin/categories/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = categoryIdParamsSchema.parse(request.params);
    const input = updateCategorySchema.parse(request.body);
    const row = await updateCategory(id, input);
    if (!row) return reply.status(404).send({ error: { message: "Kategori bulunamadı" } });
    return reply.send(row);
  });

  app.delete("/admin/categories/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = categoryIdParamsSchema.parse(request.params);
    try {
      const deleted = await deleteCategoryIfEmpty(id);
      if (!deleted) return reply.status(404).send({ error: { message: "Kategori bulunamadı" } });
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof CategoryHasProductsError) {
        return reply.status(409).send({ error: { message: "Bu kategoride ürünler var, önce onları taşıyın" } });
      }
      if (err instanceof CategoryHasChildrenError) {
        return reply.status(409).send({ error: { message: "Bu kategorinin alt kategorileri var, önce onları silin/taşıyın" } });
      }
      throw err;
    }
  });

  app.post("/admin/categories/:id/image", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = categoryIdParamsSchema.parse(request.params);
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    const buffer = await file.toBuffer();
    try {
      const image = await saveImage("categories", buffer, file.mimetype);
      const row = await updateCategoryImage(id, image);
      if (!row) return reply.status(404).send({ error: { message: "Kategori bulunamadı" } });
      return reply.send(row);
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });
};

export default adminCategoriesRoutes;
