import { FastifyPluginAsync } from "fastify";
import { addToCartSchema, removeCartItemSchema, updateCartItemSchema } from "./cart.schemas";
import { addToCart, hydrateCart, removeCartItem, updateCartItem } from "./cart.service";

const cartRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cart", async (request, reply) => {
    reply.send(await hydrateCart(request.session.cart ?? []));
  });

  app.post("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = addToCartSchema.parse(request.body);
    request.session.cart = addToCart(request.session.cart ?? [], input);
    reply.send(await hydrateCart(request.session.cart));
  });

  app.patch("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = updateCartItemSchema.parse(request.body);
    request.session.cart = updateCartItem(request.session.cart ?? [], input);
    reply.send(await hydrateCart(request.session.cart));
  });

  app.delete("/cart/items", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = removeCartItemSchema.parse(request.body);
    request.session.cart = removeCartItem(request.session.cart ?? [], input);
    reply.send(await hydrateCart(request.session.cart));
  });
};

export default cartRoutes;
