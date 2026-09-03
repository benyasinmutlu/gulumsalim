import { z } from "zod";

export const shippingAddressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  city: z.string().min(2),
  district: z.string().min(2),
  addressLine: z.string().min(5),
  zipCode: z.string().optional(),
});

// bkz. kullanıcı isteği (mockup): sepette checkbox ile seçilen ürünler
// "Tümünü Seç" ile birlikte - verilirse sadece bu kalemler ödenir, sepette
// kalan diğer kalemler dokunulmadan durur (bkz. checkout.routes.ts
// filterCartBySelection). Verilmezse (eski davranış) sepetin tamamı işlenir.
export const selectedLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
  // iyzico buyer alanında zorunlu. Yalnız ödeme sağlayıcısına iletilir;
  // sipariş veya müşteri tablosunda saklanmaz. Yabancı alıcılar pasaport
  // numarası kullanabildiği için yalnız 11 haneli TCKN ile sınırlandırılmaz.
  identityNumber: z.string().trim().min(5).max(30).regex(/^[A-Za-z0-9]+$/, "Geçerli bir kimlik veya pasaport numarası girin"),
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
  contractAcceptanceToken: z.string().min(1, "Sözleşmeyi yeniden görüntüleyin").max(1024),
  selectedLines: z.array(selectedLineSchema).min(1).optional(),
});

// Sipariş oluşturmadan, sepet + adres bilgisiyle sözleşmeyi önizlemek için -
// contractAccepted burada yok (henüz onay istenmiyor, sadece gösteriliyor).
export const contractPreviewSchema = z.object({
  shippingAddress: shippingAddressSchema,
  identityNumber: z.string().trim().min(5).max(30).regex(/^[A-Za-z0-9]+$/, "Geçerli bir kimlik veya pasaport numarası girin"),
  email: z.string().email().optional(),
  selectedLines: z.array(selectedLineSchema).min(1).optional(),
});

export const checkoutIdempotencyKeySchema = z
  .string()
  .min(16, "Ödeme güvenlik anahtarı geçersiz")
  .max(128, "Ödeme güvenlik anahtarı geçersiz")
  .regex(/^[A-Za-z0-9._:-]+$/, "Ödeme güvenlik anahtarı geçersiz");

export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type SelectedLine = z.infer<typeof selectedLineSchema>;
