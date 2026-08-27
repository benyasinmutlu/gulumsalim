import { z } from "zod";

export const feedProviderSchema = z.enum(["ikas", "ticimax", "tsoft", "ideasoft", "generic"]);
export const feedFormatSchema = z.enum(["auto", "xml", "csv", "json"]);
export const feedStatusSchema = z.enum(["active", "paused", "error"]);

const fieldPath = z.string().trim().min(1).max(160).regex(/^[\p{L}\p{N}_:@.\-[\]]+$/u, "Geçersiz alan yolu");

export const feedFieldMappingSchema = z.object({
  itemsPath: fieldPath.optional(),
  externalId: fieldPath.optional(),
  groupId: fieldPath.optional(),
  sku: fieldPath.optional(),
  barcode: fieldPath.optional(),
  name: fieldPath,
  description: fieldPath.optional(),
  brand: fieldPath.optional(),
  price: fieldPath,
  compareAtPrice: fieldPath.optional(),
  stock: fieldPath.optional(),
  availability: fieldPath.optional(),
  imageUrl: fieldPath.optional(),
  size: fieldPath.optional(),
  color: fieldPath.optional(),
});

export type FeedProvider = z.infer<typeof feedProviderSchema>;
export type FeedFormat = z.infer<typeof feedFormatSchema>;
export type FeedFieldMapping = z.infer<typeof feedFieldMappingSchema>;

const feedSourceFields = z.object({
  name: z.string().trim().min(2).max(80),
  provider: feedProviderSchema,
  format: feedFormatSchema.default("auto"),
  url: z.string().trim().min(1).max(2048),
  defaultCategoryId: z.coerce.number().int().positive(),
  intervalMinutes: z.coerce.number().int().min(15).max(1440).default(60),
  stockBuffer: z.coerce.number().int().min(0).max(1_000_000).default(0),
  missingGraceRuns: z.coerce.number().int().min(1).max(10).default(3),
  staleAfterMinutes: z.coerce.number().int().min(15).max(10_080).default(180),
  mapping: feedFieldMappingSchema.optional(),
  authorizationConfirmed: z.literal(true),
});

export const feedSourceInputSchema = feedSourceFields.superRefine((value, ctx) => {
  if (value.staleAfterMinutes < value.intervalMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["staleAfterMinutes"], message: "Bayatlama süresi kontrol aralığından kısa olamaz" });
  }
});

export const feedPreviewInputSchema = feedSourceFields.pick({
  provider: true,
  format: true,
  url: true,
  mapping: true,
  authorizationConfirmed: true,
});

export type NormalizedFeedItem = {
  externalKey: string;
  groupKey?: string;
  sku?: string;
  barcode?: string;
  name: string;
  description?: string;
  brand?: string;
  price: string;
  compareAtPrice?: string;
  stock: number;
  available: boolean;
  imageUrl?: string;
  size?: string;
  color?: string;
  dataHash: string;
};
