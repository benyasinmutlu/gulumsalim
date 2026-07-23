import { z } from "zod";

export const refundIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const refundListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const refundDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().max(500).optional(),
});
