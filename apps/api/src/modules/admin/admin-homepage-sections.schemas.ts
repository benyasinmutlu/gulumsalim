import { z } from "zod";

const ALGO_TYPES = [
  "manual",
  "featured",
  "new_arrivals",
  "best_sellers",
  "weekly_best",
  "vendor_carousel",
  "vendor_products",
  "promo_banners",
  "recently_viewed",
  "related_viewed",
  "discover_personalized",
] as const;

export const createSectionSchema = z.object({
  title: z.string().min(1),
  algoType: z.enum(ALGO_TYPES),
  config: z.record(z.string(), z.unknown()).default({}),
  sortOrder: z.number().int().default(0),
  seoSlug: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).optional(),
});

export const updateSectionSchema = z.object({
  title: z.string().min(1).optional(),
  algoType: z.enum(ALGO_TYPES).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  seoSlug: z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).nullable().optional(),
});

export const sectionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const sectionBannerBodySchema = z.object({
  bannerId: z.coerce.number().int().positive(),
});

export const sectionBannerReorderSchema = z.object({
  bannerIds: z.array(z.number().int().positive()),
});
