import { FastifyPluginAsync } from "fastify";
import { recordAdminAction } from "./admin-audit.repository";
import { confirmRefundReleaseAfterProviderCheck, countRefundsByStatus, listRefunds, resetRefundReleaseClaim, MissingPaymentInfoError, RefundNotFoundError, InvalidRefundStateError } from "./admin-refunds.repository";
import { RefundApiError, releaseRefund } from "./admin-refunds.service";
import { refundIdParamsSchema, refundListQuerySchema, refundReconcileSchema } from "./admin-refunds.schemas";

// bkz. kullanıcı isteği: "ürün satıcıya teslim edildiğinden emin
// olduğumuzda müşteriye parasını iade edeceğiz" - admin'in iade akışındaki
// tek yetkisi burası: satıcı "ürünü teslim aldım" dedikten (status
// item_received) sonra gerçek parasal iadeyi (iyzico) tetiklemek. Onay/red
// kararı artık satıcıya ait (bkz. vendor-orders.routes.ts).
const adminRefundsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/refunds", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = refundListQuerySchema.parse(request.query);
    const [items, counts] = await Promise.all([listRefunds(status), countRefundsByStatus()]);
    return reply.send({ items, counts });
  });

  app.post("/admin/refunds/:id/release", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = refundIdParamsSchema.parse(request.params);
    try {
      const row = await releaseRefund(id, request.ip);
      recordAdminAction(request.session.adminId!, "release", "refund", id, `#${id} numaralı iade için para iadesi tetiklendi`).catch(() => {});
      return reply.send(row);
    } catch (err) {
      if (err instanceof RefundNotFoundError) {
        return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
      }
      if (err instanceof InvalidRefundStateError) {
        return reply
          .status(409)
          .send({ error: { message: "Para iadesi ancak satıcı ürünü teslim aldığını onayladıktan sonra yapılabilir" } });
      }
      if (err instanceof MissingPaymentInfoError) {
        return reply.status(409).send({ error: { message: "Bu sipariş için ödeme işlem kimliği bulunamadı" } });
      }
      if (err instanceof RefundApiError) {
        return reply.status(502).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.post("/admin/refunds/:id/reconcile", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = refundIdParamsSchema.parse(request.params);
    const { providerStatus } = refundReconcileSchema.parse(request.body);
    try {
      if (providerStatus === "refunded") {
        return reply.send(await confirmRefundReleaseAfterProviderCheck(id));
      }
      const reset = await resetRefundReleaseClaim(id);
      if (!reset) throw new InvalidRefundStateError();
      return reply.send({ ok: true });
    } catch (err) {
      if (err instanceof InvalidRefundStateError) {
        return reply.status(409).send({ error: { message: "Bu iade artık kontrol bekleyen durumda değil" } });
      }
      throw err;
    }
  });
};

export default adminRefundsRoutes;
