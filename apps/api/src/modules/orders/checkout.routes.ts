import { FastifyPluginAsync } from "fastify";
import { checkoutSchema } from "./checkout.schemas";
import { EmptyCartError, handlePaymentCallback, PaymentInitError, startCheckout, UnavailableItemsError } from "./checkout.service";
import { findOrderByNumber } from "./order.repository";

const checkoutRoutes: FastifyPluginAsync = async (app) => {
  app.post("/checkout", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const { shippingAddress } = checkoutSchema.parse(request.body);
    try {
      const result = await startCheckout(request.session.customerId!, request.session.cart ?? [], shippingAddress);
      // Sipariş kalemlerine dönüştürüldü - sepet artık boşaltılır.
      request.session.cart = [];
      reply.send(result);
    } catch (err) {
      if (err instanceof EmptyCartError) {
        reply.status(400).send({ error: { message: "Sepetiniz boş" } });
        return;
      }
      if (err instanceof UnavailableItemsError) {
        reply.status(409).send({ error: { message: "Sepetinizdeki bazı ürünler artık uygun değil, lütfen sepeti gözden geçirin" } });
        return;
      }
      if (err instanceof PaymentInitError) {
        reply.status(502).send({ error: { message: err.message } });
        return;
      }
      throw err;
    }
  });

  // iyzico ödeme sonrası kullanıcının tarayıcısını buraya form-encoded
  // POST ile geri yönlendirir (token alanıyla). CSRF korumasına tabi değil
  // - istek iyzico'dan geliyor, bizim oturumumuzla ilgisi yok; gerçek
  // doğrulama token'ın iyzico'dan retrieve edilmesiyle yapılıyor.
  app.post("/payment-callback", async (request, reply) => {
    const body = request.body as { token?: string };
    if (!body.token) {
      reply.redirect(`${request.protocol}://${request.hostname}/siparis-sonucu?success=false`);
      return;
    }

    const result = await handlePaymentCallback(app, body.token);
    const query = result
      ? `order=${encodeURIComponent(result.orderNumber)}&success=${result.success}`
      : "success=false";
    reply.redirect(`${request.protocol}://${request.hostname}/siparis-sonucu?${query}`);
  });

  app.get("/orders/:orderNumber", { preHandler: app.requireCustomer }, async (request, reply) => {
    const { orderNumber } = request.params as { orderNumber: string };
    const order = await findOrderByNumber(orderNumber, request.session.customerId!);
    if (!order) {
      reply.status(404).send({ error: { message: "Sipariş bulunamadı" } });
      return;
    }
    reply.send(order);
  });
};

export default checkoutRoutes;
