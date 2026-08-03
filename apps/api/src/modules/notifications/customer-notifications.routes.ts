import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  countUnreadCustomerNotifications,
  listCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "./customer-notifications.repository";

const notificationIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const customerNotificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/my/notifications", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listCustomerNotifications(request.session.customerId!));
  });

  app.get("/my/notifications/unread-count", { preHandler: app.requireCustomer }, async (request, reply) => {
    const count = await countUnreadCustomerNotifications(request.session.customerId!);
    return reply.send({ count });
  });

  app.patch(
    "/my/notifications/:id",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      const { id } = notificationIdParamsSchema.parse(request.params);
      const row = await markCustomerNotificationRead(request.session.customerId!, id);
      if (!row) return reply.status(404).send({ error: { message: "Bildirim bulunamadı" } });
      return reply.send({ ok: true });
    },
  );

  app.post(
    "/my/notifications/mark-all-read",
    { preHandler: [app.requireCustomer, app.csrfProtection] },
    async (request, reply) => {
      await markAllCustomerNotificationsRead(request.session.customerId!);
      return reply.send({ ok: true });
    },
  );
};

export default customerNotificationsRoutes;
