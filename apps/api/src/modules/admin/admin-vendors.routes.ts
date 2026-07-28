import { FastifyPluginAsync } from "fastify";
import { countVendorsByStatus, listVendorsByStatus, updateVendorCommission } from "./admin-vendors.repository";
import { updateVendorCommissionSchema, updateVendorStatusSchema, vendorIdParamsSchema, vendorStatusFilterSchema } from "./admin-vendors.schemas";
import { applyVendorAction, removeVendor, VendorHasProductsError, VendorNotFoundError } from "./admin-vendors.service";

const adminVendorsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/vendors", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = vendorStatusFilterSchema.parse(request.query);
    const [vendorsList, counts] = await Promise.all([listVendorsByStatus(status), countVendorsByStatus()]);
    return reply.send({ vendors: vendorsList, counts });
  });

  app.patch("/admin/vendors/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = vendorIdParamsSchema.parse(request.params);
    const { action } = updateVendorStatusSchema.parse(request.body);
    try {
      const updated = await applyVendorAction(id, action);
      return reply.send(updated);
    } catch (err) {
      if (err instanceof VendorNotFoundError) {
        return reply.status(404).send({ error: { message: "Satıcı bulunamadı" } });
      }
      throw err;
    }
  });

  app.patch("/admin/vendors/:id/commission", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = vendorIdParamsSchema.parse(request.params);
    const { commissionRate } = updateVendorCommissionSchema.parse(request.body);
    const updated = await updateVendorCommission(id, commissionRate);
    if (!updated) return reply.status(404).send({ error: { message: "Satıcı bulunamadı" } });
    return reply.send(updated);
  });

  app.delete("/admin/vendors/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = vendorIdParamsSchema.parse(request.params);
    try {
      await removeVendor(id);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof VendorHasProductsError) {
        return reply.status(409).send({ error: { message: "Bu satıcının ürünleri var, önce onları kaldırın" } });
      }
      throw err;
    }
  });
};

export default adminVendorsRoutes;
