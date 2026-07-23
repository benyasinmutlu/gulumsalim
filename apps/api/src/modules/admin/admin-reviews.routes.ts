import { FastifyPluginAsync } from "fastify";
import { listPendingReviews, updateReviewStatus } from "../reviews/reviews.repository";
import { moderateReviewSchema, reviewIdParamsSchema } from "../reviews/reviews.schemas";

const adminReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/reviews", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listPendingReviews());
  });

  app.patch("/admin/reviews/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = reviewIdParamsSchema.parse(request.params);
    const { action } = moderateReviewSchema.parse(request.body);
    const updated = await updateReviewStatus(id, action === "approve" ? "approved" : "rejected");
    if (!updated) {
      return reply.status(404).send({ error: { message: "Değerlendirme bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminReviewsRoutes;
