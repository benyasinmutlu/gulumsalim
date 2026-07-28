import { FastifyPluginAsync } from "fastify";
import { checkoutSchema, contractPreviewSchema } from "./checkout.schemas";
import { hydrateCart } from "../cart/cart.service";
import { syncCartProductIndex } from "../../lib/cart-product-index";
import {
  EmailBelongsToAccountError,
  EmptyCartError,
  GuestEmailRequiredError,
  handlePaymentCallback,
  InsufficientStockError,
  PaymentInitError,
  previewContract,
  startCheckout,
  UnavailableItemsError,
} from "./checkout.service";
import { findOrderByNumber, findOrderByNumberPublic, findOrdersByCustomer } from "./order.repository";

const checkoutRoutes: FastifyPluginAsync = async (app) => {
  // Misafir checkout desteklenir - preHandler'da requireCustomer yok,
  // startCheckout oturum yoksa `email` alanından bir misafir hesabı bulur/
  // oluşturur (bkz. checkout.service.ts resolveCustomerId).
  // Ödeme öncesi, sipariş oluşturmadan gerçek bilgilerle doldurulmuş
  // Mesafeli Satış Sözleşmesi + Ön Bilgilendirme Formu önizlemesi (bkz.
  // contract-template.ts). Hiçbir DB yazma işlemi yapmaz - misafir e-posta
  // verilse bile guest customer OLUŞTURULMAZ (bkz. checkout.service.ts
  // previewContract yorumu), aksi halde her önizleme açılışı boş misafir
  // hesabı biriktirirdi.
  app.post("/checkout/contract-preview", async (request, reply) => {
    const { shippingAddress, email } = contractPreviewSchema.parse(request.body);
    try {
      const html = await previewContract(request.session.customerId, request.session.cart ?? [], shippingAddress, email);
      return reply.send({ html });
    } catch (err) {
      if (err instanceof EmptyCartError) {
        return reply.status(400).send({ error: { message: "Sepetiniz boş" } });
      }
      if (err instanceof UnavailableItemsError) {
        return reply.status(409).send({ error: { message: "Sepetinizdeki bazı ürünler artık uygun değil, lütfen sepeti gözden geçirin" } });
      }
      if (err instanceof GuestEmailRequiredError) {
        return reply.status(400).send({ error: { message: "Üye değilseniz e-posta adresinizi girmelisiniz" } });
      }
      throw err;
    }
  });

  app.post("/checkout", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { shippingAddress, email, orderNote, contractAccepted } = checkoutSchema.parse(request.body);
    try {
      const result = await startCheckout(request.session.customerId, request.session.cart ?? [], shippingAddress, email, orderNote, contractAccepted);
      // Sipariş kalemlerine dönüştürüldü - sepet artık boşaltılır.
      request.session.cart = [];
      syncCartProductIndex(app.redis, request.session.sessionId, []).catch(() => {});
      return reply.send(result);
    } catch (err) {
      if (err instanceof EmptyCartError) {
        return reply.status(400).send({ error: { message: "Sepetiniz boş" } });
      }
      if (err instanceof UnavailableItemsError) {
        // bkz. cart.service.ts hydrateCart yorumu - session'daki hayalet
        // satırı burada da temizliyoruz ki müşteri tekrar denediğinde aynı
        // hataya bir daha çarpmasın (daha önce /sepet'i hiç ziyaret etmeden
        // doğrudan ödemeye geçtiyse session hâlâ kirli olabilirdi).
        const { validCart } = await hydrateCart(request.session.cart ?? []);
        request.session.cart = validCart;
        return reply.status(409).send({ error: { message: "Sepetinizdeki bazı ürünler artık uygun değil, lütfen sepeti gözden geçirin" } });
      }
      if (err instanceof InsufficientStockError) {
        return reply.status(409).send({ error: { message: "Sepetinizdeki bir ürün için yeterli stok kalmadı, lütfen adedi güncelleyin" } });
      }
      if (err instanceof GuestEmailRequiredError) {
        return reply.status(400).send({ error: { message: "Üye değilseniz e-posta adresinizi girmelisiniz" } });
      }
      if (err instanceof EmailBelongsToAccountError) {
        return reply.status(409).send({ error: { message: "Bu e-posta adresine kayıtlı bir hesap var, lütfen giriş yapın" } });
      }
      if (err instanceof PaymentInitError) {
        return reply.status(502).send({ error: { message: err.message } });
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
      return reply.redirect(`${request.protocol}://${request.hostname}/siparis-sonucu?success=false`);
    }

    const result = await handlePaymentCallback(app, body.token);
    const query = result
      ? `order=${encodeURIComponent(result.orderNumber)}&success=${result.success}`
      : "success=false";
    return reply.redirect(`${request.protocol}://${request.hostname}/siparis-sonucu?${query}`);
  });

  app.get("/orders", { preHandler: app.requireCustomer }, async (request, reply) => {
    const rows = await findOrdersByCustomer(request.session.customerId!);
    return reply.send(rows);
  });

  // Oturum açmış müşteri için kendi siparişiyle eşleştirilerek doğrulanır;
  // misafir sipariş onay ekranı (siparis-sonucu) için oturum yoksa sipariş
  // numarasının kendisi erişim anahtarı sayılır (bkz. order.repository.ts
  // findOrderByNumberPublic yorumu).
  app.get("/orders/:orderNumber", async (request, reply) => {
    const { orderNumber } = request.params as { orderNumber: string };
    const order = request.session.customerId
      ? await findOrderByNumber(orderNumber, request.session.customerId)
      : await findOrderByNumberPublic(orderNumber);
    if (!order) {
      return reply.status(404).send({ error: { message: "Sipariş bulunamadı" } });
    }
    return reply.send(order);
  });
};

export default checkoutRoutes;
