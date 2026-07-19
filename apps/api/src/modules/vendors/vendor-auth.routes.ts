import { FastifyPluginAsync } from "fastify";
import { findVendorById } from "./vendor.repository";
import { vendorLoginSchema, vendorRegisterSchema } from "./vendor-auth.schemas";
import {
  EmailInUseError,
  InvalidCredentialsError,
  registerVendor,
  SlugInUseError,
  VendorBannedError,
  verifyVendorCredentials,
} from "./vendor-auth.service";

function publicVendor(v: { id: number; storeName: string; storeSlug: string; email: string; status: string }) {
  return { id: v.id, storeName: v.storeName, storeSlug: v.storeSlug, email: v.email, status: v.status };
}

const vendorAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/vendor/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = vendorRegisterSchema.parse(request.body);
    try {
      const vendor = await registerVendor(input);
      request.session.vendorId = vendor.id;
      reply.status(201).send(publicVendor(vendor));
    } catch (err) {
      if (err instanceof EmailInUseError) {
        reply.status(409).send({ error: { message: "Bu e-posta adresi zaten kayıtlı" } });
        return;
      }
      if (err instanceof SlugInUseError) {
        reply.status(409).send({ error: { message: "Bu mağaza adresi zaten kullanılıyor" } });
        return;
      }
      throw err;
    }
  });

  app.post("/vendor/auth/login", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = vendorLoginSchema.parse(request.body);
    try {
      const vendor = await verifyVendorCredentials(input);
      request.session.vendorId = vendor.id;
      reply.send(publicVendor(vendor));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
        return;
      }
      if (err instanceof VendorBannedError) {
        reply.status(403).send({ error: { message: "Bu satıcı hesabı yasaklanmış" } });
        return;
      }
      throw err;
    }
  });

  app.post("/vendor/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    delete request.session.vendorId;
    reply.send({ ok: true });
  });

  app.get("/vendor/auth/me", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendor = await findVendorById(request.session.vendorId!);
    if (!vendor) {
      reply.status(404).send({ error: { message: "Satıcı bulunamadı" } });
      return;
    }
    reply.send(publicVendor(vendor));
  });
};

export default vendorAuthRoutes;
