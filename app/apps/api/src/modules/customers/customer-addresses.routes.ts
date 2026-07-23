import { FastifyPluginAsync } from "fastify";
import { createAddress, deleteAddress, listAddressesByCustomer, updateAddress } from "./customer-addresses.repository";
import { addressBodySchema, addressIdParamsSchema } from "./customer-addresses.schemas";

const customerAddressesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/addresses", { preHandler: app.requireCustomer }, async (request, reply) => {
    return reply.send(await listAddressesByCustomer(request.session.customerId!));
  });

  app.post("/addresses", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const input = addressBodySchema.parse(request.body);
    return reply.status(201).send(await createAddress(request.session.customerId!, input));
  });

  app.patch("/addresses/:id", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const { id } = addressIdParamsSchema.parse(request.params);
    const input = addressBodySchema.parse(request.body);
    const row = await updateAddress(request.session.customerId!, id, input);
    if (!row) return reply.status(404).send({ error: { message: "Adres bulunamadı" } });
    return reply.send(row);
  });

  app.delete("/addresses/:id", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const { id } = addressIdParamsSchema.parse(request.params);
    const deleted = await deleteAddress(request.session.customerId!, id);
    if (!deleted) return reply.status(404).send({ error: { message: "Adres bulunamadı" } });
    return reply.send({ ok: true });
  });
};

export default customerAddressesRoutes;
