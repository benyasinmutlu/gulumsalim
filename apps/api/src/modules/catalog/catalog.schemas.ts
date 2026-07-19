import { z } from "zod";

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productSlugParamsSchema = z.object({
  slug: z.string().min(1),
});
