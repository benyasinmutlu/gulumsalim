import { FastifyPluginAsync } from "fastify";
import { createBrand, deleteBrand, listAllBrands, updateBrand } from "./admin-brands.repository";
import { brandIdParamsSchema, createBrandSchema, updateBrandSchema } from "./admin-brands.schemas";

// bkz. denetim raporu: "Marka yönetimi" - admin panelinde markaları
// listeleme/ekleme/pasife alma/silme. Kategoriler modülüyle aynı (basit
// CRUD) desen, bkz. admin-categories.routes.ts.
const adminBrandsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/brands", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllBrands());
  });

  app.post("/admin/brands", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { name, slug } = createBrandSchema.parse(request.body);
    try {
      return reply.status(201).send(await createBrand(name, slug));
    } catch (err) {
      if ((err as { code?: string })?.code === "23505") {
        return reply.status(409).send({ error: { message: "Bu marka adı veya adresi zaten kullanılıyor" } });
      }
      throw err;
    }
  });

  app.patch("/admin/brands/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = brandIdParamsSchema.parse(request.params);
    const { isActive } = updateBrandSchema.parse(request.body);
    const row = await updateBrand(id, isActive ?? true);
    if (!row) return reply.status(404).send({ error: { message: "Marka bulunamadı" } });
    return reply.send(row);
  });

  app.delete("/admin/brands/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = brandIdParamsSchema.parse(request.params);
    const deleted = await deleteBrand(id);
    if (!deleted) return reply.status(404).send({ error: { message: "Marka bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default adminBrandsRoutes;
