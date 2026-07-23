import { FastifyPluginAsync } from "fastify";
import { decideRefund, listRefunds } from "./admin-refunds.repository";
import { refundDecisionSchema, refundIdParamsSchema, refundListQuerySchema } from "./admin-refunds.schemas";

const adminRefundsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/refunds", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = refundListQuerySchema.parse(request.query);
    return reply.send(await listRefunds(status));
  });

  app.patch("/admin/refunds/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = refundIdParamsSchema.parse(request.params);
    const { action, adminNote } = refundDecisionSchema.parse(request.body);
    const row = await decideRefund(id, action === "approve" ? "approved" : "rejected", adminNote);
    if (!row) return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default adminRefundsRoutes;
