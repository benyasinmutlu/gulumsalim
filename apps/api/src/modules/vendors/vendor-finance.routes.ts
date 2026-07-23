import { FastifyPluginAsync } from "fastify";
import { getVendorWalletSummary, listVendorEarnings, listVendorPayouts } from "./vendor-finance.repository";
import { requestPayoutSchema } from "./vendor-finance.schemas";
import { InsufficientBalanceError, requestPayout } from "./vendor-finance.service";

const vendorFinanceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/wallet", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await getVendorWalletSummary(request.session.vendorId!));
  });

  app.get("/vendor/earnings", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorEarnings(request.session.vendorId!));
  });

  app.get("/vendor/payouts", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorPayouts(request.session.vendorId!));
  });

  app.post("/vendor/payouts", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = requestPayoutSchema.parse(request.body);
    try {
      const payout = await requestPayout(request.session.vendorId!, input.amount, input.iban, input.note);
      return reply.status(201).send(payout);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return reply.status(400).send({ error: { message: "Bakiye yetersiz" } });
      }
      throw err;
    }
  });
};

export default vendorFinanceRoutes;
