import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const measure = z.coerce.number().min(30).max(200);
const sizeChartSchema = z
  .record(
    z.string().trim().min(1).max(6),
    z.object({ bust: measure.optional(), waist: measure.optional(), hip: measure.optional() }),
  )
  .optional();

const optionalQueryText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);

const attributesSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(240))
  .refine((attributes) => Object.keys(attributes).length <= 20, "En fazla 20 ürün özelliği eklenebilir")
  .optional();

const optionalQueryEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.enum(values).optional());

export const productListQuerySchema = z.object({
  search: optionalQueryText,
  status: optionalQueryEnum(["draft", "pending", "active", "inactive", "rejected"]),
  stock: optionalQueryEnum(["in_stock", "low", "out_of_stock"]),
  sort: z.preprocess(
    (value) => (value === "" || value == null ? "newest" : value),
    z.enum(["newest", "oldest", "price_asc", "price_desc", "stock_asc", "stock_desc"]),
  ),
});

export const createProductSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2),
  slug: z.string().min(2).regex(slugPattern, "Ürün adresi sadece küçük harf, rakam ve tire içerebilir"),
  description: z.string().optional(),
  attributes: attributesSchema,
  brand: z.string().min(1).optional(),
  basePrice: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional(),
  // bkz. kullanıcı isteği: "bireysel olarak ... 2. el ürün letgo dolap
  // gibi" ve sonrasında "normal kurumsal satıcılar için 2.el seçeneği
  // olmasın" - şema seviyesinde her iki tip de gönderebilir, ama route
  // katmanı (vendor-products.routes.ts) kurumsal satıcı için bunu her
  // zaman false'a zorlar.
  isSecondHand: z.coerce.boolean().optional(),
  // bkz. kullanıcı isteği: "kurumsal satıcıların stokları zorunlu olarak
  // girilmeli" - sadece varyantsız (renk/beden eklenmemiş) ürünlerde
  // kullanılır, route katmanında zorunlu kılınır (bireysel satıcıda
  // yoksayılıp hep 1'e zorlanır, bkz. vendor-products.routes.ts).
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sizeChart: sizeChartSchema,
});

// "rejected" durumu kasıtlı olarak dışarıda bırakıldı - bir ürünü
// reddetmek admin'in yetkisinde (Faz 3), satıcı kendi ürününü sadece
// taslak/aktif/pasif arasında değiştirebilir. "pending" bireysel satıcının
// onaya gönder eylemi için (bkz. olay: 2026-08-02, vendor-auth.service.ts
// aynı isimli yorum) - route katmanında vendorType'a göre ayrıca
// kısıtlanır (bkz. vendor-products.routes.ts).
export const updateProductSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(slugPattern).optional(),
  description: z.string().optional(),
  attributes: attributesSchema,
  brand: z.string().min(1).optional(),
  basePrice: z.coerce.number().positive().optional(),
  compareAtPrice: z.coerce.number().positive().optional(),
  status: z.enum(["draft", "pending", "active", "inactive"]).optional(),
  freeShipping: z.coerce.boolean().optional(),
  isSecondHand: z.coerce.boolean().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sizeChart: sizeChartSchema,
});

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
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  priceOverride: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const productVariantParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive(),
});
