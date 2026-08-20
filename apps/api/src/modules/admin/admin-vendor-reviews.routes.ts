import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listPendingVendorReviews, updateVendorReviewStatus } from "../vendors/vendor-reviews.repository";

const reviewIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const moderateSchema = z.object({ action: z.enum(["approve", "reject"]) });

const adminVendorReviewsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/vendor-reviews", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listPendingVendorReviews());
  });

  app.patch("/admin/vendor-reviews/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = reviewIdParamsSchema.parse(request.params);
    const { action } = moderateSchema.parse(request.body);
    const updated = await updateVendorReviewStatus(id, action === "approve" ? "approved" : "rejected");
    if (!updated) {
      return reply.status(404).send({ error: { message: "Değerlendirme bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminVendorReviewsRoutes;
