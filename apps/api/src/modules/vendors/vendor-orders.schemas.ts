import { z } from "zod";

export const updateOrderItemStatusSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
});

export const orderItemIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
