import { z } from "zod";
import { toTitleCaseTr } from "../../lib/name-case";

const fullNameSchema = z.string().trim().min(2).max(120).transform(toTitleCaseTr);

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .max(72, "Şifre en fazla 72 karakter olabilir")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Şifre en fazla 72 bayt olabilir");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: z.string().trim().max(30).optional(),
  // Üyelik Sözleşmesi + KVKK Aydınlatma Metni - zorunlu. marketingConsent
  // (Ticari Elektronik İleti Onayı) ve analyticsConsent (Açık Rıza Metni)
  // opsiyonel, işaretlenmezse consentAt alanları null kalır.
  membershipConsent: z.literal(true, {
    errorMap: () => ({ message: "Üyelik Sözleşmesi ve KVKK Aydınlatma Metnini kabul etmelisiniz" }),
  }),
  marketingConsent: z.boolean().default(false),
  analyticsConsent: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1),
});

// bkz. auth.service.ts completeGoogleConsent - Google ile anında açılan
// hesabın girişten sonra tamamladığı zorunlu onay formu.
export const completeConsentSchema = z.object({
  membershipConsent: z.literal(true, {
    errorMap: () => ({ message: "Üyelik Sözleşmesi ve KVKK Aydınlatma Metnini kabul etmelisiniz" }),
  }),
  marketingConsent: z.boolean().default(false),
  analyticsConsent: z.boolean().default(false),
  phone: z.string().trim().max(30).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

// Beden tercihleri profilde düzenlenebilir ve ürün filtreleme/fit motorunun
// kullanıcı tarafından beyan edilen kaynağıdır. Dizi sınırları şişirme ve
// kötüye kullanımı önler.
export const sizePrefsSchema = z.object({
  kadinBeden: z.array(z.string().trim().min(1).max(10)).max(12).optional(),
  ayakkabiNo: z.array(z.coerce.number().int().min(15).max(50)).max(12).optional(),
  cocukBeden: z.array(z.string().trim().min(1).max(12)).max(12).optional(),
});

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  phone: z.string().trim().max(30).optional(),
  age: z.coerce.number().int().min(10).max(100).optional(),
  heightCm: z.coerce.number().int().min(100).max(230).optional(),
  weightKg: z.coerce.number().int().min(30).max(250).optional(),
  sizePrefs: sizePrefsSchema.optional(),
  currentPassword: z.string().max(72).optional(),
  newPassword: passwordSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type CompleteConsentInput = z.infer<typeof completeConsentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
