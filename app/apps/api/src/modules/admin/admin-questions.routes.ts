import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { deleteQuestion, listAllQuestionsForAdmin } from "../questions/questions.repository";

const questionIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const questionListQuerySchema = z.object({ filter: z.enum(["pending", "answered"]).optional() });

const adminQuestionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/questions", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { filter } = questionListQuerySchema.parse(request.query);
    return reply.send(await listAllQuestionsForAdmin(filter));
  });

  app.delete("/admin/questions/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = questionIdParamsSchema.parse(request.params);
    const deleted = await deleteQuestion(id);
    if (!deleted) return reply.status(404).send({ error: { message: "Soru bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default adminQuestionsRoutes;
