import { FastifyPluginAsync } from "fastify";
import { emitBehavioralEvent } from "../analytics/events.client";
import { findProductCategoryVendor } from "../analytics/events.repository";
import { addToCartSchema, removeCartItemSchema, updateCartItemSchema } from "./cart.schemas";
import { addToCart, hydrateCart, removeCartItem, updateCartItem } from "./cart.service";

const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cart", async (request, reply) => {
    return reply.send(await hydrateCart(request.session.cart ?? []));
  });

  app.post("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = addToCartSchema.parse(request.body);
    request.session.cart = addToCart(request.session.cart ?? [], input);

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

    return reply.send(await hydrateCart(request.session.cart));
  });

  app.patch("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = updateCartItemSchema.parse(request.body);
    request.session.cart = updateCartItem(request.session.cart ?? [], input);
    return reply.send(await hydrateCart(request.session.cart));
  });

  app.delete("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = removeCartItemSchema.parse(request.body);
    request.session.cart = removeCartItem(request.session.cart ?? [], input);
    return reply.send(await hydrateCart(request.session.cart));
  });
};

export default cartRoutes;
