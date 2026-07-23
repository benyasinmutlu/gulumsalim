import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const vendorRegisterSchema = z.object({
  storeName: z.string().min(2),
  storeSlug: z
    .string()
    .min(2)
    .regex(slugPattern, "Mağaza adresi sadece küçük harf, rakam ve tire içerebilir"),
  email: z.string().email(),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

export const vendorLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const vendorForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const vendorResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
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
  bankName: z.string().max(120).optional(),
  bankIban: z.string().max(40).optional(),
  bankAccountHolder: z.string().max(120).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı").optional(),
});

export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
export type VendorLoginInput = z.infer<typeof vendorLoginSchema>;
export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
