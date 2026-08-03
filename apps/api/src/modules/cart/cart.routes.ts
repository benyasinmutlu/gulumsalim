import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { emitBehavioralEvent } from "../analytics/events.client";
import { findProductCategoryVendor } from "../analytics/events.repository";
import { recordContentEvent } from "../analytics/content-analytics.repository";
import { addToCartSchema, applyCouponSchema, cartQuerySchema, removeCartItemSchema, updateCartItemSchema } from "./cart.schemas";
import { addToCart, hydrateCart, lineKey, removeCartItem, updateCartItem } from "./cart.service";
import { syncCartProductIndex } from "../../lib/cart-product-index";
import { validateAndComputeDiscount } from "../orders/coupon.service";

// bkz. kullanıcı isteği: "kupon kodu... admin panelde kontrol edebilelim" -
// sepetin HER görünümü (GET /cart, ürün ekle/güncelle/sil sonrası) aynı
// indirimi yansıtır. Kupon artık geçersizse (süresi doldu, limit doldu)
// sepeti KIRMAZ - sessizce kaldırılır, session'dan temizlenir.
async function buildCartResponse(
  request: FastifyRequest,
  hydrated: Awaited<ReturnType<typeof hydrateCart>>,
) {
  let discountAmount = 0;
  let couponCode: string | null = null;
  const appliedCode = request.session.couponCode;
  if (appliedCode && hydrated.items.length > 0) {
    try {
      const result = await validateAndComputeDiscount(appliedCode, request.session.customerId, Number(hydrated.subtotal));
      discountAmount = result.discountAmount;
      couponCode = result.coupon.code;
    } catch {
      request.session.couponCode = undefined;
    }
  }
  return {
    items: hydrated.items,
    subtotal: hydrated.subtotal,
    shippingFee: hydrated.shippingFee,
    shippingBreakdown: hydrated.shippingBreakdown,
    freeShippingThreshold: hydrated.freeShippingThreshold,
    couponCode,
    discountAmount: discountAmount.toFixed(2),
    stockNotices: hydrated.stockNotices,
  };
}

const cartRoutes: FastifyPluginAsync = async (app) => {
  // bkz. kullanıcı isteği (mockup): sepette checkbox ile "sadece seçilenleri
  // öde" - `selected` verilirse (ödeme sayfasının özet paneli için) yanıt
  // SADECE o kalemlerin subtotal/kargo/toplamını yansıtır; session'daki
  // gerçek sepet HER ZAMAN tam haliyle temizlenir/korunur, seçim sadece bu
  // isteğin görünümünü daraltır, sepeti değiştirmez.
  app.get("/cart", async (request, reply) => {
    const { selected } = cartQuerySchema.parse(request.query);
    const full = await hydrateCart(request.session.cart ?? []);
    // bkz. cart.service.ts hydrateCart yorumu - geçersiz satırları burada
    // session'dan da temizliyoruz ki checkout'ta sonsuz döngüye girmesin.
    request.session.cart = full.validCart;

    if (!selected) {
      return reply.send(await buildCartResponse(request, full));
    }

    const selectedKeys = new Set(selected.split(","));
    const filteredCart = full.validCart.filter((c) => selectedKeys.has(lineKey(c)));
    const filtered = await hydrateCart(filteredCart);
    return reply.send(await buildCartResponse(request, filtered));
  });

  app.post("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = addToCartSchema.parse(request.body);
    request.session.cart = addToCart(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    recordContentEvent("product", input.productId, "cart_add", input.quantity).catch(() => {});

    // Ateşle-unut - event yayını cevabı asla bekletmez.
    findProductCategoryVendor(input.productId)
      .then((info) => {
        emitBehavioralEvent(app, {
          type: "cart_add",
          customerId: request.session.customerId,
          productId: input.productId,
          vendorId: info?.vendorId,
          categoryId: info?.categoryId,
        });
      })
      .catch(() => {});

    const added = await hydrateCart(request.session.cart);
    request.session.cart = added.validCart;
    return reply.send(await buildCartResponse(request, added));
  });

  app.patch("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = updateCartItemSchema.parse(request.body);
    request.session.cart = updateCartItem(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    const updated = await hydrateCart(request.session.cart);
    request.session.cart = updated.validCart;
    return reply.send(await buildCartResponse(request, updated));
  });

  app.delete("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = removeCartItemSchema.parse(request.body);
    request.session.cart = removeCartItem(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    const removed = await hydrateCart(request.session.cart);
    request.session.cart = removed.validCart;
    return reply.send(await buildCartResponse(request, removed));
  });

  // Kupon kodu doğrulanır ve session'a yazılır (bkz. session.ts couponCode
  // yorumu) - sepetin kendisi değişmez, sadece uygulanan kod hatırlanır.
  app.post("/cart/coupon", { preHandler: app.csrfProtection }, async (request, reply) => {
    const { code } = applyCouponSchema.parse(request.body);
    const hydrated = await hydrateCart(request.session.cart ?? []);
    request.session.cart = hydrated.validCart;
    try {
      await validateAndComputeDiscount(code, request.session.customerId, Number(hydrated.subtotal));
    } catch (err) {
      return reply.status(400).send({ error: { message: couponErrorMessage(err) } });
    }
    request.session.couponCode = code.trim().toUpperCase();
    return reply.send(await buildCartResponse(request, hydrated));
  });

  app.delete("/cart/coupon", { preHandler: app.csrfProtection }, async (request, reply) => {
    request.session.couponCode = undefined;
    const hydrated = await hydrateCart(request.session.cart ?? []);
    request.session.cart = hydrated.validCart;
    return reply.send(await buildCartResponse(request, hydrated));
  });
};

function couponErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    switch (err.constructor.name) {
      case "CouponNotFoundError":
        return "Geçersiz kupon kodu";
      case "CouponExpiredError":
        return "Bu kuponun süresi dolmuş";
      case "CouponMinOrderError":
        return "Bu kupon için minimum sepet tutarına ulaşılmadı";
      case "CouponUsageLimitError":
        return "Bu kuponun kullanım limitine ulaşıldı";
    }
  }
  return "Kupon uygulanamadı";
}

export default cartRoutes;
