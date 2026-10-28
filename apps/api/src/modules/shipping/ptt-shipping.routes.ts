import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { PttError } from "./ptt.client";
import {
  PttNotConfiguredError,
  PttShipmentBusyError,
  PttShipmentNotFoundError,
  PttShipmentValidationError,
  refreshPttShipment,
  registerPttShipment,
} from "./ptt-shipment.service";

const shipmentParams = z.object({ id: z.coerce.number().int().positive() });
const packageSchema = z.object({
  weightGrams: z.number().int().positive().max(1_000_000),
  widthCm: z.number().positive().max(9_999).optional(),
  lengthCm: z.number().positive().max(9_999).optional(),
  heightCm: z.number().positive().max(9_999).optional(),
}).refine((value) => {
  const dimensionCount = [value.widthCm, value.lengthCm, value.heightCm].filter((dimension) => dimension != null).length;
  return dimensionCount === 0 || dimensionCount === 3;
}, { message: "Paket ölçüsü girilecekse en, boy ve yükseklik birlikte girilmeli" });
const registerBody = z.object({
  package: packageSchema.optional(),
});

function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof PttShipmentNotFoundError) return reply.status(404).send({ error: { message: "Gönderi bulunamadı" } });
  if (error instanceof PttNotConfiguredError) return reply.status(503).send({ error: { message: error.message, code: "PTT_NOT_CONFIGURED" } });
  if (error instanceof PttShipmentValidationError) return reply.status(400).send({ error: { message: error.message, code: "PTT_VALIDATION" } });
  if (error instanceof PttShipmentBusyError) return reply.status(409).send({ error: { message: error.message, code: "PTT_RECONCILING" } });
  if (error instanceof PttError) {
    return reply.status(error.retryable ? 503 : 422).send({ error: { message: error.message, code: error.code } });
  }
  throw error;
}

const pttShippingRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/vendor/shipments/:id/ptt/register",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = shipmentParams.parse(request.params);
      const body = registerBody.parse(request.body ?? {});
      try {
        return reply.send(await registerPttShipment(request.session.vendorId!, id, body.package));
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post(
    "/vendor/shipments/:id/ptt/refresh",
    { preHandler: [app.requireVendor, app.csrfProtection] },
    async (request, reply) => {
      const { id } = shipmentParams.parse(request.params);
      try {
        return reply.send(await refreshPttShipment(request.session.vendorId!, id));
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

};

export default pttShippingRoutes;
