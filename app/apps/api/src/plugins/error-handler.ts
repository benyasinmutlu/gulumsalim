import fp from "fastify-plugin";
import { FastifyError, FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";

// Tek, tutarlı hata gövdesi: { error: { message, details? } }. Zod
// doğrulama hataları 400'e, beklenmeyen her şey loglanıp 500'e düşer —
// müşteriye asla ham stack trace veya sorgu detayı sızmaz.
const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: { message: "Geçersiz istek", details: error.flatten() },
      });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.status(statusCode).send({ error: { message: "Sunucu hatası" } });
    }

    return reply.status(statusCode).send({ error: { message: error.message } });
  });
};

export default fp(errorHandlerPlugin, { name: "error-handler" });
