import { FastifyPluginAsync } from "fastify";
import { InvalidImageError, saveImage } from "../../lib/image-upload";
import {
  addRefundPhoto,
  createCustomerRefundRequest,
  DuplicateRefundRequestError,
  InvalidRefundStateError,
  ItemNotDeliveredError,
  listCustomerRefunds,
  OrderItemNotFoundError,
  RefundNotFoundError,
  submitReturnTracking,
} from "./customer-refunds.repository";
import { createRefundRequestSchema, orderItemIdParamsSchema, refundIdParamsSchema, submitTrackingSchema } from "./customer-refunds.schemas";

// bkz. kullanıcı isteği: "iade süreçlerinde ürün iade edildiğinde satıcıya
// müşteri sebepleri yazıyor fotoğrafları vs atıyor bu da yine müşteri
// panelinden olacak" - müşteri talebi açar+fotoğraf ekler, satıcı panelinde
// onaylanır/reddedilir (bkz. vendor-orders.routes.ts), onaylanınca müşteri
// kargo takip kodunu buradan girer.
const customerRefundsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/refunds", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listCustomerRefunds(request.session.customerId!));
  });

  app.post(
    "/orders/items/:orderItemId/refund-request",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { orderItemId } = orderItemIdParamsSchema.parse(request.params);
      const { reason } = createRefundRequestSchema.parse(request.body);
      try {
        const refund = await createCustomerRefundRequest(request.session.customerId!, orderItemId, reason);
        return reply.status(201).send(refund);
      } catch (err) {
        if (err instanceof OrderItemNotFoundError) {
          return reply.status(404).send({ error: { message: "Sipariş kalemi bulunamadı" } });
        }
        if (err instanceof ItemNotDeliveredError) {
          return reply.status(409).send({ error: { message: "İade talebi yalnızca teslim edilmiş ürünler için açılabilir" } });
        }
        if (err instanceof DuplicateRefundRequestError) {
          return reply.status(409).send({ error: { message: "Bu ürün için zaten bir iade talebiniz var" } });
        }
        throw err;
      }
    },
  );

  app.post(
    "/refunds/:id/photos",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { id } = refundIdParamsSchema.parse(request.params);
      const file = await request.file();
      if (!file) return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
      const buffer = await file.toBuffer();
      try {
        const image = await saveImage("refunds", buffer, file.mimetype);
        const refund = await addRefundPhoto(request.session.customerId!, id, image);
        if (!refund) return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        return reply.status(201).send(refund);
      } catch (err) {
        if (err instanceof InvalidImageError) {
          return reply.status(400).send({ error: { message: err.message } });
        }
        if (err instanceof RefundNotFoundError) {
          return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        }
        if (err instanceof InvalidRefundStateError) {
          return reply.status(409).send({ error: { message: "Bu talebe artık fotoğraf eklenemez" } });
        }
        throw err;
      }
    },
  );

  app.post(
    "/refunds/:id/return-tracking",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { id } = refundIdParamsSchema.parse(request.params);
      const { carrier, trackingNumber } = submitTrackingSchema.parse(request.body);
      try {
        const refund = await submitReturnTracking(request.session.customerId!, id, carrier, trackingNumber);
        if (!refund) return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        return reply.send(refund);
      } catch (err) {
        if (err instanceof RefundNotFoundError) {
          return reply.status(404).send({ error: { message: "İade talebi bulunamadı" } });
        }
        if (err instanceof InvalidRefundStateError) {
          return reply
            .status(409)
            .send({ error: { message: "Kargo takip kodu yalnızca satıcı onayladıktan sonra girilebilir" } });
        }
        throw err;
      }
    },
  );
};

export default customerRefundsRoutes;
