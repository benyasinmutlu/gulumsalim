import { z } from "zod";

export const collectionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const addCollectionProductSchema = z.object({
  productId: z.coerce.number().int().positive(),
  sortOrder: z.coerce.number().int().optional(),
});

export const moveCollectionProductSchema = z.object({
  direction: z.enum(["up", "down"]),
});
