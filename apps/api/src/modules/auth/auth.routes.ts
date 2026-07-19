import { FastifyPluginAsync } from "fastify";
import { findCustomerById } from "./auth.repository";
import { loginSchema, registerSchema } from "./auth.schemas";
import {
  EmailInUseError,
  InvalidCredentialsError,
  registerCustomer,
  verifyCustomerCredentials,
} from "./auth.service";

function publicCustomer(c: { id: number; email: string; fullName: string }) {
  return { id: c.id, email: c.email, fullName: c.fullName };
}

const authRoutes: FastifyPluginAsync = async (app) => {
  // Frontend, mutasyon isteklerinden önce bu token'ı alıp header'da geri
  // gönderir (bkz. plugins/csrf.ts). Kendisi bir mutasyon olmadığı için
  // CSRF korumasına tabi değil.
  app.get("/auth/csrf-token", async (request, reply) => {
    reply.send({ csrfToken: await reply.generateCsrf() });
  });

  app.post("/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    try {
      const customer = await registerCustomer(input);
      request.session.customerId = customer.id;
      reply.status(201).send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof EmailInUseError) {
        reply.status(409).send({ error: { message: "Bu e-posta adresi zaten kayıtlı" } });
        return;
      }
      throw err;
    }
  });

  app.post("/auth/login", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const customer = await verifyCustomerCredentials(input);
      request.session.customerId = customer.id;
      reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
        return;
      }
      throw err;
    }
  });

  app.post("/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    await request.session.destroy();
    reply.send({ ok: true });
  });

  app.get("/auth/me", { preHandler: app.requireCustomer }, async (request, reply) => {
    const customer = await findCustomerById(request.session.customerId!);
    if (!customer) {
      reply.status(404).send({ error: { message: "Kullanıcı bulunamadı" } });
      return;
    }
    reply.send(publicCustomer(customer));
  });
};

export default authRoutes;
