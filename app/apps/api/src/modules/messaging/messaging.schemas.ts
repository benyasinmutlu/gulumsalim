import { z } from "zod";

export const vendorIdParamsSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});
