import { FastifyPluginAsync } from "fastify";
import {
  getVendorWalletSummary,
  listVendorEarnings,
  listVendorPayouts,
  listVendorRefundsWithOrder,
} from "./vendor-finance.repository";
import { requestPayoutSchema } from "./vendor-finance.schemas";
import {
  BankAccountCoolingOffError,
  BankAccountMismatchError,
  InsufficientBalanceError,
  MissingBankAccountError,
  requestPayout,
} from "./vendor-finance.service";

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

  app.get("/vendor/finance-refunds", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorRefundsWithOrder(request.session.vendorId!));
  });

  app.post("/vendor/payouts", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const input = requestPayoutSchema.parse(request.body);
    try {
      const payout = await requestPayout(request.session.vendorId!, input.amount, input.iban, input.accountHolder, input.note);
      return reply.status(201).send(payout);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return reply.status(400).send({ error: { message: "Bakiye yetersiz" } });
      }
      if (err instanceof MissingBankAccountError) {
        return reply.status(400).send({ error: { code: "bank_account_missing", message: "Ödeme talebinden önce Ayarlar bölümünden banka hesabınızı doğrulayın" } });
      }
      if (err instanceof BankAccountMismatchError) {
        return reply.status(409).send({ error: { code: "bank_account_mismatch", message: "Ödeme yalnız Ayarlar bölümünde doğrulanan banka hesabına yapılabilir" } });
      }
      if (err instanceof BankAccountCoolingOffError) {
        return reply.status(409).send({
          error: {
            code: "bank_account_cooling_off",
            message: `Yeni banka hesabınız ${err.availableAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinden sonra ödeme alabilir`,
          },
        });
      }
      throw err;
    }
  });
};

export default vendorFinanceRoutes;
