import { z } from "zod";

export const orderIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const orderListQuerySchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
});
