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
  // bkz. kullanıcı isteği: "bireysel olarak ... 2. el ürün letgo dolap
  // gibi" - hem kurumsal hem bireysel satıcılar bir ürünü 2. el olarak
  // işaretleyebilir.
  isSecondHand: z.coerce.boolean().optional(),
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
  freeShipping: z.coerce.boolean().optional(),
  isSecondHand: z.coerce.boolean().optional(),
});

// Satıcı ürün listesi filtre/sıralama parametreleri (bkz. kullanıcı isteği:
// "filtreleme ve analiz"). Hepsi opsiyonel; boş string'ler undefined'a
// indirgenir, sort her zaman geçerli bir değere düşer.
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const productListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(["draft", "active", "inactive", "rejected"]).optional()),
  stock: z.preprocess(emptyToUndefined, z.enum(["in", "low", "out"]).optional()),
  sort: z.preprocess(
    emptyToUndefined,
    z
      .enum(["newest", "oldest", "price_asc", "price_desc", "stock_asc", "stock_desc", "most_viewed", "most_favorited"])
      .default("newest"),
  ),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const productImageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

// bkz. kullanıcı isteği: "sku'yu otomatik oluştursun sistem" - satıcı
// isterse kendi SKU'sunu girebilir (entegrasyon/etiketleme ihtiyacı olabilir),
// ama varsayılan akış boş bırakılırsa sunucu otomatik ve benzersiz bir SKU
// üretir (bkz. vendor-products.repository.ts generateVariantSku).
export const createVariantSchema = z.object({
  sku: z.string().min(1).optional(),
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
