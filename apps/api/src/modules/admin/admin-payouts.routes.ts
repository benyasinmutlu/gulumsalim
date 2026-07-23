import { FastifyPluginAsync } from "fastify";
import { getPlatformFinanceStats, listProcessedPayouts, listVendorFinanceSummaries } from "./admin-finance.repository";
import { listPayouts } from "./admin-payouts.repository";
import { payoutIdParamsSchema, payoutStatusFilterSchema, processPayoutSchema } from "./admin-payouts.schemas";
import { approvePayout, PayoutAlreadyProcessedError, PayoutNotFoundError, rejectPayout } from "./admin-payouts.service";

const adminPayoutsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/payouts", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = payoutStatusFilterSchema.parse(request.query);
    return reply.send(await listPayouts(status));
  });

  app.get("/admin/payouts/processed", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listProcessedPayouts());
  });

  app.get("/admin/finance-overview", { preHandler: app.requireAdmin }, async (_request, reply) => {
    const [stats, vendorSummaries] = await Promise.all([getPlatformFinanceStats(), listVendorFinanceSummaries()]);
    return reply.send({ stats, vendorSummaries });
  });

  app.patch("/admin/payouts/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = payoutIdParamsSchema.parse(request.params);
    const { action, reason } = processPayoutSchema.parse(request.body);
    try {
      const updated =
        action === "approve"
          ? await approvePayout(id, request.session.adminId!)
          : await rejectPayout(id, request.session.adminId!, reason);
      return reply.send(updated);
    } catch (err) {
      if (err instanceof PayoutNotFoundError) {
        return reply.status(404).send({ error: { message: "Ödeme talebi bulunamadı" } });
      }
      if (err instanceof PayoutAlreadyProcessedError) {
        return reply.status(409).send({ error: { message: "Bu talep zaten işlenmiş" } });
      }
      throw err;
    }
  });
};

export default adminPayoutsRoutes;
