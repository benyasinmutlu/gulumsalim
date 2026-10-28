import { z } from "zod";
import { isShoutingTitle } from "../product-intelligence/normalize/text";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// bkz. denetim raporu madde 5: "Ürün başlığı standardizasyonu" - karakter
// sınırı (normalizeTitle'daki NAME_MAX ile aynı) + tamamen büyük harfli
// spam başlık reddi. Fazla boşluk/kontrol karakteri temizliği zaten
// normalizeTitle() ile route katmanında yapılıyor (bkz. vendor-products.routes.ts).
const productNameSchema = z
  .string()
  .min(2)
  .max(200, "Ürün adı en fazla 200 karakter olabilir")
  .refine((value) => !isShoutingTitle(value), "Ürün adını tamamen büyük harfle yazmayın");

// bkz. denetim raporu madde 1: "Ürün kondisyonu zorunlu olmalı".
export const productConditionValues = ["new_with_tags", "new_without_tags", "very_good", "good", "used"] as const;
const productConditionSchema = z.enum(productConditionValues);

// bkz. denetim raporu madde 2: "Kusur/deformasyon sistemi" - "evet" ise
// açıklama zorunlu (fotoğraf zorunluluğu, ürünü onaya/aktife gönderirken
// ayrıca kontrol edilir, bkz. vendor-products.routes.ts PATCH).
const defectFields = {
  hasDefect: z.coerce.boolean().optional(),
  defectDescription: z.string().trim().max(500).optional(),
};
function refineDefect(data: { hasDefect?: boolean; defectDescription?: string }, ctx: z.RefinementCtx) {
  if (data.hasDefect && (!data.defectDescription || data.defectDescription.trim().length < 5)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["defectDescription"], message: "Kusuru en az birkaç kelimeyle açıklayın" });
  }
}

const measure = z.coerce.number().min(30).max(200);
const sizeChartSchema = z
  .record(
    z.string().trim().min(1).max(6),
    z.object({ bust: measure.optional(), waist: measure.optional(), hip: measure.optional() }),
  )
  .optional();

// bkz. kargo/PTT denetim raporu Faz 1 (2026-09-10): ürün/varyant fiziksel
// kargo verisi - üst sınırlar DB check constraint'leriyle (catalog.ts)
// birebir aynı (50kg / 500cm). Opsiyonel: satıcı doldurmazsa null kalır,
// mevcut ürünlere geriye dönük hiçbir değer zorlanmaz.
const weightGramsSchema = z.coerce.number().int().min(0).max(50_000).optional();
const dimensionCmSchema = z.coerce.number().min(0).max(500).optional();
const shippingDimensionFields = {
  weightGrams: weightGramsSchema,
  widthCm: dimensionCmSchema,
  heightCm: dimensionCmSchema,
  lengthCm: dimensionCmSchema,
};

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

export const createProductSchema = z
  .object({
    categoryId: z.number().int().positive(),
    name: productNameSchema,
    slug: z.string().min(2).regex(slugPattern, "Ürün adresi sadece küçük harf, rakam ve tire içerebilir"),
    description: z.string().optional(),
    attributes: attributesSchema,
    brand: z.string().min(1).optional(),
    // bkz. denetim raporu madde 1: her yeni ürün için zorunlu.
    condition: productConditionSchema,
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
    ...defectFields,
    ...shippingDimensionFields,
  })
  .superRefine(refineDefect);

// "rejected" durumu kasıtlı olarak dışarıda bırakıldı - bir ürünü
// reddetmek admin'in yetkisinde (Faz 3), satıcı kendi ürününü sadece
// taslak/aktif/pasif arasında değiştirebilir. "pending" bireysel satıcının
// onaya gönder eylemi için (bkz. olay: 2026-08-02, vendor-auth.service.ts
// aynı isimli yorum) - route katmanında vendorType'a göre ayrıca
// kısıtlanır (bkz. vendor-products.routes.ts).
export const updateProductSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    name: productNameSchema.optional(),
    slug: z.string().min(2).regex(slugPattern).optional(),
    description: z.string().optional(),
    attributes: attributesSchema,
    brand: z.string().min(1).optional(),
    condition: productConditionSchema.optional(),
    basePrice: z.coerce.number().positive().optional(),
    compareAtPrice: z.coerce.number().positive().optional(),
    status: z.enum(["draft", "pending", "active", "inactive"]).optional(),
    freeShipping: z.coerce.boolean().optional(),
    isSecondHand: z.coerce.boolean().optional(),
    stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
    sizeChart: sizeChartSchema,
    ...defectFields,
    ...shippingDimensionFields,
  })
  .superRefine(refineDefect);

export const productIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// bkz. denetim raporu madde 2: kusur fotoğrafı, genel görsel yükleme
// ucuna (POST /vendor/products/:id/images) bir sorgu parametresiyle
// işaretlenir - ayrı bir endpoint gerekmedi (bkz. vendor-products.routes.ts).
export const productImageUploadQuerySchema = z.object({
  isDefectPhoto: z.coerce.boolean().optional(),
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
  ...shippingDimensionFields,
});

export const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  priceOverride: z.coerce.number().positive().optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  ...shippingDimensionFields,
});

export const productVariantParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive(),
});
