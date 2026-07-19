import { FastifyPluginAsync } from "fastify";
import { listProductsQuerySchema, productSlugParamsSchema } from "./catalog.schemas";
import { getCategories, getProductBySlug, getProducts } from "./catalog.service";

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/categories", async (_request, reply) => {
    reply.send(await getCategories());
  });

  app.get("/products", async (request, reply) => {
    const query = listProductsQuerySchema.parse(request.query);
    reply.send(await getProducts(query));
  });

  app.get("/products/:slug", async (request, reply) => {
    const { slug } = productSlugParamsSchema.parse(request.params);
    const product = await getProductBySlug(slug);
    if (!product) {
      reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      return;
    }
    reply.send(product);
  });
};

export default catalogRoutes;
