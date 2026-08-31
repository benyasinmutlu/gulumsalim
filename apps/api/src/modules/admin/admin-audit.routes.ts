import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listAdminAuditLog } from "./admin-audit.repository";

const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// bkz. denetim raporu: "İşlem logları" - admin panelinde satıcı onayı/
// yasaklama, ürün moderasyonu, iade/ödeme kararlarının kalıcı kaydı.
const adminAuditRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/audit-log", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { limit } = auditLogQuerySchema.parse(request.query);
    return reply.send(await listAdminAuditLog(limit));
  });
};

export default adminAuditRoutes;
