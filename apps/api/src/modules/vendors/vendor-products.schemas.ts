import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createProductSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2),
  slug: z.string().min(2).regex(slugPattern, "Ürün adresi sadece küçük harf, rakam ve tire içerebilir"),
  description: z.string().optional(),
  brand: z.string().min(1).optional(),
  basePrice: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional(),
});

// "rejected" durumu kasıtlı olarak dışarıda bırakıldı - bir ürünü
// reddetmek admin'in yetkisinde (Faz 3), satıcı kendi ürününü sadece
// taslak/aktif/pasif arasında değiştirebilir.
export const updateProductSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(slugPattern).optional(),
  description: z.string().optional(),
  brand: z.string().min(1).optional(),
  basePrice: z.coerce.number().positive().optional(),
  compareAtPrice: z.coerce.number().positive().optional(),
  status: z.enum(["draft", "active", "inactive"]).optional(),
});

export const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const productImageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

export const createVariantSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  priceOverride: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).default(0),
});

export const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  priceOverride: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).optional(),
});

export const productVariantParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive(),
});
