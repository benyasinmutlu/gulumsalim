import { FastifyPluginAsync } from "fastify";
import { findActiveProductIdBySlug } from "../catalog/catalog.repository";
import { getReviewSummary, listApprovedReviews, listPendingReviewItems, listReviewsByCustomer } from "./reviews.repository";
import { createReviewSchema } from "./reviews.schemas";
import { AlreadyReviewedError, NotPurchasedError, submitReview } from "./reviews.service";

const reviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/my/reviews", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listReviewsByCustomer(request.session.customerId!));
  });

  app.get("/my/pending-reviews", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listPendingReviewItems(request.session.customerId!));
  });

  app.get("/products/:slug/reviews", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const product = await findActiveProductIdBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    const [reviews, summary] = await Promise.all([
      listApprovedReviews(product.id),
      getReviewSummary(product.id),
    ]);
    return reply.send({ reviews, summary });
  });

  app.post(
    "/products/:slug/reviews",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const product = await findActiveProductIdBySlug(slug);
      if (!product) {
        return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      }
      const input = createReviewSchema.parse(request.body);
      try {
        const review = await submitReview(request.session.customerId!, product.id, input);
        return reply.status(201).send(review);
      } catch (err) {
        if (err instanceof NotPurchasedError) {
          return reply
            .status(403)
            .send({ error: { message: "Bu ürünü değerlendirmek için önce satın alıp teslim almış olmalısınız" } });
        }
        if (err instanceof AlreadyReviewedError) {
          return reply.status(409).send({ error: { message: "Bu siparişi zaten değerlendirdiniz" } });
        }
        throw err;
      }
    },
  );
};

export default reviewsRoutes;
