import { z } from "zod";

// Anahtar/değer serbest - admin panel yeni bir ayar anahtarı eklerse şema
// değişikliği gerekmesin diye (gulumsalim.com'daki settings tablosu da
// aynı şekilde şemasız key/value).
export const updateSettingsSchema = z.record(z.string(), z.string());

export const updateAdminProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı").optional(),
});

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
