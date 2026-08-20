import { z } from "zod";
import { isValidTurkishIban, normalizeIban } from "../../lib/iban";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(72, "Şifre en fazla 72 karakter olabilir")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Şifre en fazla 72 bayt olabilir");
const corporateTaxIdSchema = z
  .string()
  .trim()
  .regex(/^(?:\d{10}|\d{11}|\d{16})$/, "10 haneli VKN, 11 haneli TCKN veya 16 haneli MERSİS No giriniz");

export const vendorRegisterSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  storeSlug: z
    .string()
    .min(2)
    .max(80)
    .regex(slugPattern, "Mağaza adresi sadece küçük harf, rakam ve tire içerebilir"),
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional(),
  // Mesafeli Satış Sözleşmesi'nin satıcı bloğu için zorunlu (bkz.
  // vendors.ts taxId/legalAddress).
  taxId: corporateTaxIdSchema,
  legalAddress: z.string().trim().min(10, "Açık adres giriniz").max(500),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Satıcı Üyelik ve Hizmet Sözleşmesi'ni kabul etmelisiniz" }),
  }),
});

// "Tek tıkla bireysel satıcı ol" akışı da (bkz. vendor-auth.routes.ts
// /my/become-individual-seller) aynı hukuki gerekliliğe tabi - artık body
// zorunlu.
export const becomeIndividualSellerSchema = z.object({
  storeName: z.string().trim().min(2).max(120),
  taxId: z.string().trim().regex(/^\d{11}$/, "11 haneli TCKN giriniz"),
  legalAddress: z.string().trim().min(10, "Açık adres giriniz").max(500),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: "Satıcı Üyelik ve Hizmet Sözleşmesi'ni kabul etmelisiniz" }),
  }),
});

export const vendorLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const vendorForgotPasswordSchema = z.object({
  email: emailSchema,
});

export const vendorResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

// vendor/store.php + vendor/settings.php'nin birleşik karşılığı - mağaza
// profili ve hesap ayarları tek PATCH /vendor/auth/me altında, frontend'de
// iki ayrı sayfaya (Mağaza Profili / Ayarlar) bölünüyor.
export const updateVendorProfileSchema = z.object({
  storeName: z.string().min(2).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  about: z.string().max(2000).optional(),
  logo: z.string().optional(),
  coverImage: z.string().optional(),
  city: z.string().max(120).optional(),
  whatsapp: z.string().max(30).optional(),
  instagram: z.string().max(255).optional(),
  facebook: z.string().max(255).optional(),
  twitter: z.string().max(255).optional(),
  youtube: z.string().max(255).optional(),
  tiktok: z.string().max(255).optional(),
  website: z.string().max(255).optional(),
  seoTitle: z.string().max(255).optional(),
  seoDescription: z.string().max(500).optional(),
  bankName: z.string().trim().max(120).optional(),
  bankIban: z
    .string()
    .max(40)
    .transform(normalizeIban)
    .refine((value) => value === "" || isValidTurkishIban(value), "Geçerli bir Türkiye IBAN'ı giriniz")
    .optional(),
  bankAccountHolder: z.string().trim().max(120).optional(),
  taxId: corporateTaxIdSchema.optional(),
  legalAddress: z.string().trim().min(10, "Açık adres giriniz").max(500).optional(),
  currentPassword: z.string().max(72).optional(),
  newPassword: passwordSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.bankIban && (!data.bankAccountHolder || data.bankAccountHolder.length < 2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccountHolder"], message: "IBAN için hesap sahibi gerekli" });
  }
});

export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
export type BecomeIndividualSellerInput = z.infer<typeof becomeIndividualSellerSchema>;
export type VendorLoginInput = z.infer<typeof vendorLoginSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
