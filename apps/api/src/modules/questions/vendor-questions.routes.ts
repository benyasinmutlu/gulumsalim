import { FastifyPluginAsync } from "fastify";
import { answerQuestion, findQuestionOwnedByVendor, listVendorQuestions } from "./questions.repository";
import { answerQuestionSchema, questionIdParamsSchema } from "./questions.schemas";

// Satıcının kendi ürünlerine gelen tüm soruları (cevaplı/cevapsız) tek
// listede görüp cevaplayabildiği ekran - /vendor/products/:id altında
// değil, çünkü satıcı sorulara ürün bazında değil tek bir gelen kutusundan
// bakmak istiyor.
const vendorQuestionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/questions", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorQuestions(request.session.vendorId!));
  });

  app.patch(
    "/vendor/questions/:id",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = questionIdParamsSchema.pick({ id: true }).parse(request.params);
      const owned = await findQuestionOwnedByVendor(request.session.vendorId!, id);
      if (!owned) {
        return reply.status(404).send({ error: { message: "Soru bulunamadı" } });
      }
      const { answer } = answerQuestionSchema.parse(request.body);
      await answerQuestion(id, answer);
      return reply.send({ ok: true });
    },
  );
};

export default vendorQuestionsRoutes;
