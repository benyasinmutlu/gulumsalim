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
  app.post("/admin/auth/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = adminLoginSchema.parse(request.body);
    try {
      const admin = await verifyAdminCredentials(input);
      await request.session.regenerate(["cart", "customerId", "vendorId"]);
      request.session.adminId = admin.id;
      return reply.send(publicAdmin(admin));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "Kullanıcı adı veya şifre hatalı" } });
      }
      throw err;
    }
  });

  app.post("/admin/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    delete request.session.adminId;
    return reply.send({ ok: true });
  });

  // bkz. auth.routes.ts /auth/logout - düz link tabanlı, JS'e bağımlı değil.
  app.get("/admin/auth/logout", async (request, reply) => {
    delete request.session.adminId;
    return reply.redirect("/admin/giris");
  });

  app.get("/admin/auth/me", { preHandler: app.requireAdmin }, async (request, reply) => {
    const admin = await findAdminById(request.session.adminId!);
    if (!admin) {
      return reply.status(404).send({ error: { message: "Admin bulunamadı" } });
    }
    return reply.send(publicAdmin(admin));
  });
};

export default adminAuthRoutes;
