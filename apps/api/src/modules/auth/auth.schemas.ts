import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  fullName: z.string().min(2),
  phone: z.string().optional(),
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
  email: z.string().email(),
  password: z.string().min(1),
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
  phone: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional(),
  age: z.coerce.number().int().min(10).max(100).optional(),
  heightCm: z.coerce.number().int().min(100).max(230).optional(),
  weightKg: z.coerce.number().int().min(30).max(250).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı").optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type CompleteConsentInput = z.infer<typeof completeConsentSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
