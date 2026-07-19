import { FastifyPluginAsync } from "fastify";
import { listPayouts } from "./admin-payouts.repository";
import { payoutIdParamsSchema, payoutStatusFilterSchema, processPayoutSchema } from "./admin-payouts.schemas";
import { approvePayout, PayoutAlreadyProcessedError, PayoutNotFoundError, rejectPayout } from "./admin-payouts.service";

const adminPayoutsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/payouts", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = payoutStatusFilterSchema.parse(request.query);
    reply.send(await listPayouts(status));
  });

  app.patch("/admin/payouts/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = payoutIdParamsSchema.parse(request.params);
    const { action, reason } = processPayoutSchema.parse(request.body);
    try {
      const updated =
        action === "approve"
          ? await approvePayout(id, request.session.adminId!)
          : await rejectPayout(id, request.session.adminId!, reason);
      reply.send(updated);
    } catch (err) {
      if (err instanceof PayoutNotFoundError) {
        reply.status(404).send({ error: { message: "Ödeme talebi bulunamadı" } });
        return;
      }
      if (err instanceof PayoutAlreadyProcessedError) {
        reply.status(409).send({ error: { message: "Bu talep zaten işlenmiş" } });
        return;
      }
      throw err;
    }
  });
};

export default adminPayoutsRoutes;
