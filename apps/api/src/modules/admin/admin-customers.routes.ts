import { FastifyPluginAsync } from "fastify";
import { listCustomers } from "./admin-customers.repository";
import { customerListQuerySchema } from "./admin-customers.schemas";

const adminCustomersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/admin/customers", { preHandler: app.requireAdmin }, async (request, reply) => {
    const { search } = customerListQuerySchema.parse(request.query);
    return reply.send(await listCustomers(search));
  });
};

export default adminCustomersRoutes;
