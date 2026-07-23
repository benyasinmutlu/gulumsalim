import { z } from "zod";

export const orderItemIdParamsSchema = z.object({
  orderItemId: z.coerce.number().int().positive(),
});

export const refundIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createRefundRequestSchema = z.object({
  reason: z.string().min(10, "Lütfen iade sebebini biraz daha detaylandırın").max(1000),
});

// Kargo firması serbest metin (bkz. iyzico.client.ts benzeri "doğru olanı
// yap" kararı) - Türkiye'deki başlıca firmalar admin/vendor/musteri arayüzünde
// açılır listede sunulur ama sabit bir enum'a kilitlenmez, "Diğer" seçilirse
// serbest yazılabilir.
export const submitTrackingSchema = z.object({
  carrier: z.string().min(2).max(60),
  trackingNumber: z.string().min(2).max(100),
});
