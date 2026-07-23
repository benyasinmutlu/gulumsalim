import { FastifyPluginAsync } from "fastify";
import { findActiveProductIdBySlug } from "../catalog/catalog.repository";
import { insertQuestion, listAnsweredQuestions, listQuestionsByCustomer } from "./questions.repository";
import { createQuestionSchema } from "./questions.schemas";

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
    return reply.send(await listAnsweredQuestions(product.id));
  });

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
