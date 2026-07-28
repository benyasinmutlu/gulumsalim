import { z } from "zod";

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  saleOnly: z.coerce.boolean().optional(),
  // Meilisearch tabanlı facet filtreleri/sıralama (bkz. catalog.search.ts) -
  // bunlardan biri verilirse sorgu Postgres keyset yerine Meilisearch'e gider.
  size: z.string().optional(),
  color: z.string().optional(),
  brand: z.string().optional(),
  vendor: z.string().optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(["price-asc", "price-desc", "newest", "popular"]).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productSlugParamsSchema = z.object({
  slug: z.string().min(1),
});

export const toggleFavoriteSchema = z.object({
  productId: z.number().int().positive(),
});
