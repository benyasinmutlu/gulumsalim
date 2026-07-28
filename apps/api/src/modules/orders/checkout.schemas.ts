import { z } from "zod";

export const shippingAddressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  city: z.string().min(2),
  district: z.string().min(2),
  addressLine: z.string().min(5),
  zipCode: z.string().optional(),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  // Üye olmayan (misafir) checkout için gerekli - oturum açmış müşteride
  // zaten var olan e-posta kullanılır, bu alan yalnızca misafir akışında
  // zorunlu tutulur (bkz. checkout.service.ts startCheckout).
  email: z.string().email().optional(),
  orderNote: z.string().max(500).optional(),
  // Ödeme öncesi gerçek bilgilerle doldurulmuş Mesafeli Satış Sözleşmesi +
  // Ön Bilgilendirme Formu önizlemesinin görülüp onaylandığının kanıtı -
  // bkz. contract-template.ts, order.contractSnapshot.
  contractAccepted: z.literal(true, {
    errorMap: () => ({ message: "Mesafeli Satış Sözleşmesi'ni onaylamalısınız" }),
  }),
});

// Sipariş oluşturmadan, sepet + adres bilgisiyle sözleşmeyi önizlemek için -
// contractAccepted burada yok (henüz onay istenmiyor, sadece gösteriliyor).
export const contractPreviewSchema = z.object({
  shippingAddress: shippingAddressSchema,
  email: z.string().email().optional(),
});

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
