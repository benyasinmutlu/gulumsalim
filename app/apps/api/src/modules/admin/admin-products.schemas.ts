import { z } from "zod";

export const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const productListQuerySchema = z.object({
  status: z.enum(["draft", "active", "inactive", "rejected"]).optional(),
  search: z.string().optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  stock: z.enum(["low", "out"]).optional(),
});

export const updateProductStatusSchema = z.object({
  status: z.enum(["draft", "active", "inactive", "rejected"]),
});
