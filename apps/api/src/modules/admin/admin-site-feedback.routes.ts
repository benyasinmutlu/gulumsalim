import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listSiteFeedback, markSiteFeedbackRead } from "../content/site-feedback.repository";

const feedbackIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

// bkz. kullanıcı isteği: "websitesine her giren kişiye ... değerlendirme
// yeri çıkartalım" - admin tarafındaki okuma kuyruğu.
const adminSiteFeedbackRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/site-feedback", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listSiteFeedback());
  });

  app.patch("/admin/site-feedback/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = feedbackIdParamsSchema.parse(request.params);
    const row = await markSiteFeedbackRead(id);
    if (!row) return reply.status(404).send({ error: { message: "Geri bildirim bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default adminSiteFeedbackRoutes;
