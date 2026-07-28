import { z } from "zod";

export const categoryIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  icon: z.string().optional(),
  iconColor: z.string().optional(),
  image: z.string().optional(),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});
