import { FastifyPluginAsync } from "fastify";
import { findReviewOwnedByVendor, listVendorReviews, replyToReview } from "./reviews.repository";
import { replyToReviewSchema, reviewIdParamsSchema } from "./reviews.schemas";

// vendor/reviews.php'nin karşılığı - satıcının kendi ürünlerine gelen
// değerlendirmeleri görüp yanıtlayabildiği ekran (bkz. sorular için aynı
// desendeki vendor-questions.routes.ts).
const vendorReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/reviews", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorReviews(request.session.vendorId!));
  });

  app.patch("/vendor/reviews/:id", { preHandler: [app.requireVendor, app.csrfProtection] }, async (request, reply) => {
    const { id } = reviewIdParamsSchema.parse(request.params);
    const owned = await findReviewOwnedByVendor(request.session.vendorId!, id);
    if (!owned) {
      return reply.status(404).send({ error: { message: "Değerlendirme bulunamadı" } });
    }
    const { reply: replyText } = replyToReviewSchema.parse(request.body);
    await replyToReview(id, replyText);
    return reply.send({ ok: true });
  });
};

export default vendorReviewsRoutes;
