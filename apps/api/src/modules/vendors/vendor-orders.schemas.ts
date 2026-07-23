import { z } from "zod";

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
});

export const orderItemIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createRefundRequestSchema = z.object({
  reason: z.string().min(5).max(500),
});
