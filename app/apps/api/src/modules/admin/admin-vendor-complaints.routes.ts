import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { listAllComplaints, updateComplaintStatus } from "../vendors/vendor-complaints.repository";

const complaintIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
const moderateSchema = z.object({ action: z.enum(["review", "dismiss"]), adminNote: z.string().max(1000).optional() });

// bkz. kullanıcı isteği: "mağazayı şikayet et bölümü ekleyelim" - admin
// tarafındaki inceleme kuyruğu (vendor-reviews moderasyonuyla aynı desen).
const adminVendorComplaintsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/vendor-complaints", { preHandler: app.requireAdmin }, async (_request, reply) => {
    return reply.send(await listAllComplaints());
  });

  app.patch("/admin/vendor-complaints/:id", { preHandler: [app.requireAdmin, app.csrfProtection] }, async (request, reply) => {
    const { id } = complaintIdParamsSchema.parse(request.params);
    const { action, adminNote } = moderateSchema.parse(request.body);
    const updated = await updateComplaintStatus(id, action === "review" ? "reviewed" : "dismissed", adminNote);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Şikayet bulunamadı" } });
    }
    return reply.send({ ok: true });
  });
};

export default adminVendorComplaintsRoutes;
