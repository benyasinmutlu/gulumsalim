import { z } from "zod";

// bkz. kullanıcı isteği: "satıcı takip kodunu sisteme girecek hem müşteri
// hem de admin görebilecek" - "shipped" durumuna geçerken kargo firması +
// takip numarası zorunlu, diğer durum geçişlerinde alakasız/gönderilmez.
export const updateOrderItemStatusSchema = z
  .object({
    status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
    trackingCarrier: z.string().min(1).max(60).optional(),
    trackingNumber: z.string().min(1).max(100).optional(),
  })
  .refine((data) => data.status !== "shipped" || (data.trackingCarrier && data.trackingNumber), {
    message: "Kargoya verildi olarak işaretlemek için kargo firması ve takip numarası gerekli",
    path: ["trackingNumber"],
  });

export const orderItemIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// bkz. kullanıcı isteği: "filtreleme ve analiz" - satıcı sipariş listesi
// durum + arama (sipariş no / ürün / müşteri e-postası) ile filtrelenip
// tarihe göre sıralanabilir. Boş query-string değerleri undefined'a düşer.
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const orderListQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
  ),
  sort: z.preprocess(emptyToUndefined, z.enum(["newest", "oldest"]).default("newest")),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

// bkz. kullanıcı isteği: "iadeyi onaylarsa satıcı" - iade talebi artık
// müşteri panelinden açılıyor (bkz. customer-refunds.schemas.ts), satıcı
// sadece onaylıyor/reddediyor.
export const vendorRefundDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  vendorNote: z.string().max(500).optional(),
});

export const refundIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
