import { FastifyPluginAsync, FastifyReply } from "fastify";
import { checkoutIdempotencyKeySchema, checkoutSchema, contractPreviewSchema, type SelectedLine } from "./checkout.schemas";
import { hydrateCart, lineKey } from "../cart/cart.service";
import type { CartLine } from "../cart/cart.types";
import { syncCartProductIndex } from "../../lib/cart-product-index";
import { env } from "../../config/env";

// bkz. checkout.schemas.ts selectedLines yorumu - verilmezse sepetin tamamı
// (eski davranış), verilirse sadece eşleşen kalemler işleme alınır.
function filterCartBySelection(cart: CartLine[], selectedLines?: SelectedLine[]): CartLine[] {
  if (!selectedLines || selectedLines.length === 0) return cart;
  const keys = new Set(selectedLines.map((l) => lineKey(l)));
  return cart.filter((c) => keys.has(lineKey(c)));
}
import {
  EmailBelongsToAccountError,
  EmptyCartError,
  GuestEmailRequiredError,
  handlePaymentCallback,
  IdempotencyConflictError,
  CheckoutInProgressError,
  InsufficientStockError,
  InvalidContractAcceptanceError,
  PaymentInitError,
  previewContract,
  startCheckout,
  UnavailableItemsError,
} from "./checkout.service";
import { CouponExpiredError, CouponMinOrderError, CouponNotFoundError, CouponUsageLimitError } from "./coupon.service";
import { findOrderByNumber, findOrderByNumberAndEmail, findOrderByNumberForSignedAccess, findOrdersByCustomer } from "./order.repository";
import { createOrderAccessToken, verifyOrderAccessToken } from "./order-access-token";

function couponErrorReply(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof CouponNotFoundError) {
    reply.status(400).send({ error: { message: "Geçersiz kupon kodu" } });
    return true;
  }
  if (err instanceof CouponExpiredError) {
    reply.status(400).send({ error: { message: "Bu kuponun süresi dolmuş" } });
    return true;
  }
  if (err instanceof CouponMinOrderError) {
    reply.status(400).send({ error: { message: `Bu kupon için minimum ${err.minOrderAmount.toFixed(2)} TL sepet tutarı gerekli` } });
    return true;
  }
  if (err instanceof CouponUsageLimitError) {
    reply.status(400).send({ error: { message: "Bu kuponun kullanım limitine ulaşıldı" } });
    return true;
  }
  return false;
}

const checkoutRoutes: FastifyPluginAsync = async (app) => {
  const siteOrigin = new URL(env.SITE_URL).origin;
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
    const { shippingAddress, identityNumber, email, selectedLines } = contractPreviewSchema.parse(request.body);
    try {
      const cart = filterCartBySelection(request.session.cart ?? [], selectedLines);
      const preview = await previewContract(
        request.session.customerId,
        cart,
        shippingAddress,
        identityNumber,
        request.session.sessionId,
        email,
        request.session.couponCode,
      );
      return reply.send(preview);
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
      if (err instanceof EmailBelongsToAccountError) {
        return reply.status(409).send({ error: { message: "Bu e-posta adresine kayıtlı bir hesap var, lütfen giriş yapın" } });
      }
      if (couponErrorReply(reply, err)) return;
      throw err;
    }
  });

  app.post("/checkout", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { shippingAddress, identityNumber, email, orderNote, contractAccepted, contractAcceptanceToken, selectedLines } = checkoutSchema.parse(request.body);
    const rawIdempotencyKey = request.headers["idempotency-key"];
    const idempotencyKey = checkoutIdempotencyKeySchema.parse(Array.isArray(rawIdempotencyKey) ? rawIdempotencyKey[0] : rawIdempotencyKey);
    try {
      const cart = filterCartBySelection(request.session.cart ?? [], selectedLines);
      const result = await startCheckout(
        request.session.customerId,
        cart,
        shippingAddress,
        email,
        orderNote,
        contractAccepted,
        request.session.couponCode,
        identityNumber,
        request.ip,
        contractAcceptanceToken,
        request.session.sessionId,
        idempotencyKey,
      );
      // bkz. kullanıcı isteği: "ödeme bekleniyor veya ödeme başarısız olunca
      // siparişlerde listeleme sepette kalmaya devam etsin ürünler" - sepet
      // BURADA artık boşaltılmıyor (sipariş henüz "pending", ödeme daha
      // iyzico'ya gitmedi bile) - sadece ödeme GERÇEKTEN başarılı olunca
      // /payment-callback'te temizlenir (bkz. checkout.service.ts
      // handlePaymentCallback). Böylece ödeme başarısız olursa müşteri
      // sepetini kaybetmeden tekrar deneyebilir.
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
      if (err instanceof InvalidContractAcceptanceError) {
        return reply.status(409).send({ error: { code: "contract_changed", message: "Sepet veya teslimat bilgileriniz değişti. Sözleşmeyi yeniden görüntüleyip onaylayın." } });
      }
      if (err instanceof IdempotencyConflictError) {
        return reply.status(409).send({ error: { code: "idempotency_conflict", message: "Bu ödeme denemesi farklı bilgilerle daha önce kullanılmış. Sayfayı yenileyip tekrar deneyin." } });
      }
      if (err instanceof CheckoutInProgressError) {
        return reply.status(409).send({ error: { code: "checkout_in_progress", message: "Ödeme isteğiniz işleniyor. Birkaç saniye sonra tekrar deneyin; yeniden sipariş oluşturulmayacak." } });
      }
      if (err instanceof PaymentInitError) {
        return reply.status(502).send({ error: { message: err.message } });
      }
      if (couponErrorReply(reply, err)) return;
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
      return reply.redirect(`${siteOrigin}/siparis-sonucu?success=false`);
    }

    const result = await handlePaymentCallback(app, body.token);
    // bkz. kullanıcı isteği: "ödeme bekleniyor veya ödeme başarısız olunca
    // ... sepette kalmaya devam etsin" - sepet SADECE ödeme gerçekten
    // başarılı olunca, satın alınan satırlar bilinerek burada temizlenir
    // (bkz. checkout.service.ts handlePaymentCallback purchasedLines).
    if (result?.success && result.purchasedLines) {
      const purchasedKeys = new Set(result.purchasedLines.map((l) => lineKey(l)));
      request.session.cart = (request.session.cart ?? []).filter((c) => !purchasedKeys.has(lineKey(c)));
      request.session.couponCode = undefined;
      syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    }
    const query = result
      ? `order=${encodeURIComponent(result.orderNumber)}&success=${result.success}&access=${createOrderAccessToken(result.orderNumber)}`
      : "success=false";
    return reply.redirect(`${siteOrigin}/siparis-sonucu?${query}`);
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
    const { access, email } = request.query as { access?: string; email?: string };
    let order = request.session.customerId
      ? await findOrderByNumber(orderNumber, request.session.customerId)
      : null;

    // Giris yapmamis kullanici icin siparis numarasi tek basina yetmez:
    // odeme callback'inin imzali anahtari veya takip formundaki eslesen e-posta
    // gerekir. Yetkisiz ve var olmayan sipariste ayni 404 donerek enumeration
    // bilgisini de sizdirmiyoruz.
    if (!order && verifyOrderAccessToken(orderNumber, access)) {
      order = await findOrderByNumberForSignedAccess(orderNumber);
    } else if (!order && email) {
      order = await findOrderByNumberAndEmail(orderNumber, email);
    }
    if (!order) {
      return reply.status(404).send({ error: { message: "Sipariş bulunamadı" } });
    }
    return reply.send(order);
  });
};

export default checkoutRoutes;
