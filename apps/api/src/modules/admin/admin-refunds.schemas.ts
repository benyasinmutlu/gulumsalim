import { z } from "zod";

export const refundIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const refundListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "item_received", "refunded"]).optional(),
});
