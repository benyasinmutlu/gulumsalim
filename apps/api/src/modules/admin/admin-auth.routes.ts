import { FastifyPluginAsync } from "fastify";
import { findAdminById } from "./admin.repository";
import { adminLoginSchema } from "./admin-auth.schemas";
import { InvalidCredentialsError, verifyAdminCredentials } from "./admin-auth.service";

function publicAdmin(a: { id: number; username: string; fullName: string }) {
  return { id: a.id, username: a.username, fullName: a.fullName };
}

// Kasıtlı olarak public bir /admin/auth/register yok - admin hesapları
// sadece infra/postgres/seed/seed-admin.ts ile sunucuya elle eklenir.
const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/admin/auth/login", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = adminLoginSchema.parse(request.body);
    try {
      const admin = await verifyAdminCredentials(input);
      request.session.adminId = admin.id;
      reply.send(publicAdmin(admin));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        reply.status(401).send({ error: { message: "Kullanıcı adı veya şifre hatalı" } });
        return;
      }
      throw err;
    }
  });

  app.post("/admin/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    delete request.session.adminId;
    reply.send({ ok: true });
  });

  app.get("/admin/auth/me", { preHandler: app.requireAdmin }, async (request, reply) => {
    const admin = await findAdminById(request.session.adminId!);
    if (!admin) {
      reply.status(404).send({ error: { message: "Admin bulunamadı" } });
      return;
    }
    reply.send(publicAdmin(admin));
  });
};

export default adminAuthRoutes;
