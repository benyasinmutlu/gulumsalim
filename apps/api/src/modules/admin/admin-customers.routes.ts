import { FastifyPluginAsync } from "fastify";
import { CustomerNotFoundError, deleteCustomerAccount } from "../auth/auth.service";
import { listCustomers } from "./admin-customers.repository";
import { customerIdParamsSchema, customerListQuerySchema } from "./admin-customers.schemas";

const adminCustomersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/customers", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { search } = customerListQuerySchema.parse(request.query);
    return reply.send(await listCustomers(search));
  });

  // bkz. auth.service.ts deleteCustomerAccount: sipariş/değerlendirme/soru
  // izi olan hesaplar referans bütünlüğü için anonimleştirilir (kalıcı
  // silinmez), iz bırakmamış hesaplar doğrudan silinir - müşterinin kendi
  // "hesabımı sil" akışıyla AYNI fonksiyon, admin burada onun yerine
  // tetikliyor.
  app.delete("/admin/customers/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = customerIdParamsSchema.parse(request.params);
    try {
      await deleteCustomerAccount(id);
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof CustomerNotFoundError) {
        return reply.status(404).send({ error: { message: "Müşteri bulunamadı" } });
      }
      throw err;
    }
  });
};

export default adminCustomersRoutes;
