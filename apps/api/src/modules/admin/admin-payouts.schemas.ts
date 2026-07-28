import { z } from "zod";

export const payoutStatusFilterSchema = z.object({
  status: z.enum(["pending", "paid", "rejected"]).optional(),
});

export const processPayoutSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),
});

export const payoutIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
