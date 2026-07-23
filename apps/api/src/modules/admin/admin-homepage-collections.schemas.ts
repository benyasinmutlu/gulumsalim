import { z } from "zod";

export const createCollectionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  textColor: z.string().optional(),
  linkType: z.enum(["category", "vendor", "url"]).optional(),
  linkValue: z.string().optional(),
});

export const updateCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  textColor: z.string().optional(),
  linkType: z.enum(["category", "vendor", "url"]).optional(),
  linkValue: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const collectionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const addCollectionProductSchema = z.object({
  productId: z.number().int().positive(),
});
