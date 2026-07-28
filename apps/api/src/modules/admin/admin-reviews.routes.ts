import { FastifyPluginAsync } from "fastify";
import { countReviewsByStatus, deleteReview, listAllReviews, updateReviewStatus } from "../reviews/reviews.repository";
import { moderateReviewSchema, reviewIdParamsSchema, reviewListQuerySchema } from "../reviews/reviews.schemas";

const STATUS_MAP = { approve: "approved", reject: "rejected", unapprove: "pending" } as const;

const adminReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/reviews", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { status } = reviewListQuerySchema.parse(request.query);
    const [items, counts] = await Promise.all([listAllReviews(status), countReviewsByStatus()]);
    return reply.send({ items, counts });
  });

  app.patch("/admin/reviews/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = reviewIdParamsSchema.parse(request.params);
    const { action } = moderateReviewSchema.parse(request.body);
    const updated = await updateReviewStatus(id, STATUS_MAP[action]);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Değerlendirme bulunamadı" } });
    }
    return reply.send({ ok: true });
  });

  app.delete("/admin/reviews/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = reviewIdParamsSchema.parse(request.params);
    const deleted = await deleteReview(id);
    if (!deleted) {
      return reply.status(404).send({ error: { message: "Değerlendirme bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminReviewsRoutes;
