import { FastifyPluginAsync } from "fastify";
import {
  decideVendorRefund,
  InvalidRefundStateError,
  listVendorOrderItems,
  listVendorRefunds,
  markRefundReceivedByVendor,
  RefundNotFoundError,
} from "./vendor-orders.repository";
import { orderItemIdParamsSchema, refundIdParamsSchema, updateOrderItemStatusSchema, vendorRefundDecisionSchema } from "./vendor-orders.schemas";
import {
  InvalidStatusTransitionError,
  MissingTrackingInfoError,
  OrderItemNotFoundError,
  transitionOrderItemStatus,
} from "./vendor-orders.service";
import { sendShippingNotification } from "./shipping-notification.service";

const vendorOrdersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/orders", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorOrderItems(request.session.vendorId!));
  });

  app.get("/vendor/refunds", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorRefunds(request.session.vendorId!));
  });

  // bkz. kullanıcı isteği: "iadeyi onaylarsa satıcı ürün satıcının eline
  // geçtiğinde satıcı panelden ürününü aldığını belirtiyor" - onay/red
  // kararı burada, admin'in rolü sadece nihai parasal iade (bkz.
  // admin-refunds.routes.ts).
  app.patch(
    "/vendor/refunds/:id",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = refundIdParamsSchema.parse(request.params);
      const { action, vendorNote } = vendorRefundDecisionSchema.parse(request.body);
      try {
        const row = await decideVendorRefund(request.session.vendorId!, id, action === "approve" ? "approved" : "rejected", vendorNote);
        return reply.send(row);
      } catch (err) {
        if (err instanceof RefundNotFoundError) {
          return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        }
        if (err instanceof InvalidRefundStateError) {
          return reply.status(409).send({ error: { message: "Bu talep için zaten karar verilmiş" } });
        }
        throw err;
      }
    },
  );

  app.post(
    "/vendor/refunds/:id/received",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = refundIdParamsSchema.parse(request.params);
      try {
        const row = await markRefundReceivedByVendor(request.session.vendorId!, id);
        return reply.send(row);
      } catch (err) {
        if (err instanceof RefundNotFoundError) {
          return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        }
        if (err instanceof InvalidRefundStateError) {
          return reply
            .status(409)
            .send({ error: { message: "Ürün ancak onaylanmış bir iade talebinde teslim alındı olarak işaretlenebilir" } });
        }
        throw err;
      }
    },
  );

  app.patch("/vendor/orders/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = orderItemIdParamsSchema.parse(request.params);
    const { status, trackingCarrier, trackingNumber } = updateOrderItemStatusSchema.parse(request.body);
    try {
      const tracking = trackingCarrier && trackingNumber ? { carrier: trackingCarrier, number: trackingNumber } : undefined;
      const updated = await transitionOrderItemStatus(request.session.vendorId!, id, status, tracking);
      // Kargoya verildiyse müşteriye takip e-postası gönder - best-effort:
      // yanıtı bloklamaz, gönderim hatası kargolamayı/HTTP'yi bozmaz.
      if (status === "shipped" && updated) {
        void sendShippingNotification(updated.id).catch((err) =>
          request.log.warn({ err, orderItemId: updated.id }, "kargo takip e-postası gönderilemedi"),
        );
      }
      return reply.send(updated);
    } catch (err) {
      if (err instanceof OrderItemNotFoundError) {
        return reply.status(404).send({ error: { message: "Sipariş kalemi bulunamadı" } });
      }
      if (err instanceof InvalidStatusTransitionError) {
        return reply.status(409).send({ error: { message: err.message } });
      }
      if (err instanceof MissingTrackingInfoError) {
        return reply.status(400).send({ error: { message: "Kargo firması ve takip numarası gerekli" } });
      }
      throw err;
    }
  });
};

export default vendorOrdersRoutes;
