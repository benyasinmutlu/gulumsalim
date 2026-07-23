import fp from "fastify-plugin";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    requireCustomer: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireVendor: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authGuardPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("requireCustomer", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.customerId) {
      return reply.status(401).send({ error: { message: "Giriş yapmanız gerekiyor" } });
    }
  });

  app.decorate("requireVendor", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.vendorId) {
      return reply.status(401).send({ error: { message: "Satıcı girişi yapmanız gerekiyor" } });
    }
  });

  app.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.adminId) {
      return reply.status(401).send({ error: { message: "Admin girişi yapmanız gerekiyor" } });
    }
  });
};

export default fp(authGuardPlugin, { name: "auth-guard", dependencies: ["session"] });
