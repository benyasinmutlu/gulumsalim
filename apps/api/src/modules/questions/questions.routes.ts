import { FastifyPluginAsync } from "fastify";
import { findActiveProductIdBySlug } from "../catalog/catalog.repository";
import {
  findQuestionForProduct,
  insertQuestion,
  listAnsweredQuestions,
  listQuestionsByCustomer,
  toggleQuestionHelpful,
} from "./questions.repository";
import { createQuestionSchema, questionHelpfulParamsSchema } from "./questions.schemas";

const questionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/my/questions", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listQuestionsByCustomer(request.session.customerId!));
  });

  app.get("/products/:slug/questions", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const product = await findActiveProductIdBySlug(slug);
    if (!product) {
      return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
    }
    return reply.send(await listAnsweredQuestions(product.id, request.session.customerId));
  });

  // bkz. denetim raporu madde 18: "Faydalı soru-cevapların ürün sayfasında
  // yayınlanması" - bir soruyu faydalı bulma/geri çekme (toggle).
  app.post(
    "/products/:slug/questions/:id/helpful",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const { id } = questionHelpfulParamsSchema.parse(request.params);
      const product = await findActiveProductIdBySlug(slug);
      if (!product) {
        return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      }
      const question = await findQuestionForProduct(product.id, id);
      if (!question) {
        return reply.status(404).send({ error: { message: "Soru bulunamadı" } });
      }
      const voted = await toggleQuestionHelpful(id, request.session.customerId!);
      return reply.send({ voted });
    },
  );

  app.post(
    "/products/:slug/questions",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { slug } = request.params as { slug: string };
      const product = await findActiveProductIdBySlug(slug);
      if (!product) {
        return reply.status(404).send({ error: { message: "Ürün bulunamadı" } });
      }
      const { question } = createQuestionSchema.parse(request.body);
      const row = await insertQuestion(product.id, request.session.customerId!, question);
      return reply.status(201).send(row);
    },
  );
};

export default questionsRoutes;
