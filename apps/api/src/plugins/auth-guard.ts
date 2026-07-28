import fp from "fastify-plugin";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { findVendorAccessStatus } from "../modules/vendors/vendor.repository";
import { isVendorSessionAllowed } from "./vendor-access";

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

    const status = await findVendorAccessStatus(request.session.vendorId);
    if (!isVendorSessionAllowed(status)) {
      delete request.session.vendorId;
      return reply.status(403).send({ error: { message: "Satıcı hesabınızın erişimi kapatılmış" } });
    }
  });

  app.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session.adminId) {
      return reply.status(401).send({ error: { message: "Admin girişi yapmanız gerekiyor" } });
    }
  });
};

export default fp(authGuardPlugin, { name: "auth-guard", dependencies: ["session"] });
