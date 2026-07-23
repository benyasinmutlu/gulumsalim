import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import csrfProtection from "@fastify/csrf-protection";

// Durum değiştiren her rota (register/login/logout, sepet, checkout vb.)
// bu eklentinin sağladığı app.csrfProtection preHandler'ını kullanır.
// Token, oturuma bağlı (sessionPlugin: '@fastify/session') — ayrı bir
// çereze gerek yok, session zaten Redis'te.
const csrfPlugin: FastifyPluginAsync = async (app) => {
  await app.register(csrfProtection, { sessionPlugin: "@fastify/session" });
};

export default fp(csrfPlugin, { name: "csrf", dependencies: ["session"] });
