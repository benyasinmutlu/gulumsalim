import { FastifyPluginAsync } from "fastify";
import {
  countUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  listVendorNotifications,
} from "./notifications.repository";
import { countUnreadForVendor } from "../messaging/messaging.repository";
import { countUnreadCustomerMessagesForVendor } from "../messaging/customer-messaging.repository";
import { countPendingVendorOrders } from "../vendors/vendor-orders.repository";
import { z } from "zod";

const notificationIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/vendor/notifications", { preHandler: app.requireVendor }, async (request, reply) => {
    return reply.send(await listVendorNotifications(request.session.vendorId!));
  });

  // Sidebar'daki bildirim/mesaj rozet sayaçları için - tek istekte ikisi
  // birden döner, satıcı paneli her sayfa geçişinde iki ayrı çağrı yapmasın.
  app.get("/vendor/unread-summary", { preHandler: app.requireVendor }, async (request, reply) => {
    const vendorId = request.session.vendorId!;
    const [notifications, adminMessages, customerMessages, pendingOrders] = await Promise.all([
      countUnreadNotifications(vendorId),
      countUnreadForVendor(vendorId),
      countUnreadCustomerMessagesForVendor(vendorId),
      countPendingVendorOrders(vendorId),
    ]);
    return reply.send({ notifications, messages: adminMessages + customerMessages, pendingOrders });
  });

  app.patch(
    "/vendor/notifications/:id",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = notificationIdParamsSchema.parse(request.params);
      const row = await markNotificationRead(request.session.vendorId!, id);
      if (!row) return reply.status(404).send({ error: { message: "Bildirim bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/vendor/notifications/mark-all-read",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      await markAllNotificationsRead(request.session.vendorId!);
      return reply.send({ ok: true });
    },
  );
};

export default notificationsRoutes;
