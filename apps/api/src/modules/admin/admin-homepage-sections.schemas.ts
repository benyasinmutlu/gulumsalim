import { z } from "zod";

const ALGO_TYPES = [
  "manual",
  "featured",
  "new_arrivals",
  "best_sellers",
  "weekly_best",
  "vendor_carousel",
  "recently_viewed",
  "related_viewed",
  "discover_personalized",
] as const;

export const createSectionSchema = z.object({
  title: z.string().min(1),
  algoType: z.enum(ALGO_TYPES),
  config: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().default(0),
});

export const updateSectionSchema = z.object({
  title: z.string().min(1).optional(),
  algoType: z.enum(ALGO_TYPES).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const sectionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
