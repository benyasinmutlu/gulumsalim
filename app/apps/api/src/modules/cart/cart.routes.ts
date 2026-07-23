import { FastifyPluginAsync } from "fastify";
import { emitBehavioralEvent } from "../analytics/events.client";
import { findProductCategoryVendor } from "../analytics/events.repository";
import { addToCartSchema, removeCartItemSchema, updateCartItemSchema } from "./cart.schemas";
import { addToCart, hydrateCart, removeCartItem, updateCartItem } from "./cart.service";
import { syncCartProductIndex } from "../../lib/cart-product-index";

const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cart", async (request, reply) => {
    const { items, subtotal, validCart, shippingFee, freeShippingThreshold } = await hydrateCart(request.session.cart ?? []);
    // bkz. cart.service.ts hydrateCart yorumu - geçersiz satırları burada
    // session'dan da temizliyoruz ki checkout'ta sonsuz döngüye girmesin.
    request.session.cart = validCart;
    return reply.send({ items, subtotal, shippingFee, freeShippingThreshold });
  });

  app.post("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = addToCartSchema.parse(request.body);
    request.session.cart = addToCart(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});

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
    return reply.send({ items: added.items, subtotal: added.subtotal, shippingFee: added.shippingFee, freeShippingThreshold: added.freeShippingThreshold });
  });

  app.patch("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = updateCartItemSchema.parse(request.body);
    request.session.cart = updateCartItem(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    const updated = await hydrateCart(request.session.cart);
    request.session.cart = updated.validCart;
    return reply.send({ items: updated.items, subtotal: updated.subtotal, shippingFee: updated.shippingFee, freeShippingThreshold: updated.freeShippingThreshold });
  });

  app.delete("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = removeCartItemSchema.parse(request.body);
    request.session.cart = removeCartItem(request.session.cart ?? [], input);
    syncCartProductIndex(app.redis, request.session.sessionId, request.session.cart.map((c) => c.productId)).catch(() => {});
    const removed = await hydrateCart(request.session.cart);
    request.session.cart = removed.validCart;
    return reply.send({ items: removed.items, subtotal: removed.subtotal, shippingFee: removed.shippingFee, freeShippingThreshold: removed.freeShippingThreshold });
  });
};

export default cartRoutes;
