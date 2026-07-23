import { FastifyPluginAsync } from "fastify";
import { findAdminById } from "./admin.repository";
import { getAllSettings, upsertSettings } from "./admin-settings.repository";
import { updateAdminProfileSchema, updateSettingsSchema } from "./admin-settings.schemas";
import { updateAdminOwnProfile, WrongCurrentPasswordError } from "./admin-auth.service";
import { InvalidImageError, saveImage } from "../../lib/image-upload";

const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/settings", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await getAllSettings());
  });

  app.patch("/admin/settings", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const values = updateSettingsSchema.parse(request.body);
    await upsertSettings(values);
    return reply.send(await getAllSettings());
  });

  app.post("/admin/settings/logo", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { message: "Görsel dosyası gerekli" } });
    }
    const buffer = await file.toBuffer();
    try {
      const image = await saveImage("site/logo", buffer, file.mimetype);
      await upsertSettings({ site_logo: image });
      return reply.send({ site_logo: image });
    } catch (err) {
      if (err instanceof InvalidImageError) {
        return reply.status(400).send({ error: { message: err.message } });
      }
      throw err;
    }
  });

  app.get("/admin/profile", { preHandler: app.requireAdmin }, async (request, reply) => {
    const admin = await findAdminById(request.session.adminId!);
    if (!admin) return reply.status(404).send({ error: { message: "Admin bulunamadı" } });
    return reply.send({ id: admin.id, username: admin.username, fullName: admin.fullName });
  });

  app.patch("/admin/profile", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const input = updateAdminProfileSchema.parse(request.body);
    try {
      const admin = await updateAdminOwnProfile(request.session.adminId!, input);
      return reply.send({ id: admin.id, username: admin.username, fullName: admin.fullName });
    } catch (err) {
      if (err instanceof WrongCurrentPasswordError) {
        return reply.status(400).send({ error: { message: "Mevcut şifrenizi hatalı girdiniz" } });
      }
      throw err;
    }
  });
};

export default adminSettingsRoutes;
