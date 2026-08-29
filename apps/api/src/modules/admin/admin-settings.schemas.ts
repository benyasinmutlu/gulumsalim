import { z } from "zod";
import { isKnownPublicSettingSafe } from "../../lib/public-settings-security";

// Anahtar/değer serbest - admin panel yeni bir ayar anahtarı eklerse şema
// değişikliği gerekmesin diye (gulumsalim.com'daki settings tablosu da
// aynı şekilde şemasız key/value).
export const updateSettingsSchema = z.record(z.string(), z.string()).superRefine((values, context) => {
  for (const [key, value] of Object.entries(values)) {
    if (!isKnownPublicSettingSafe(key, value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Ayar değeri beklenen güvenli formatta değil",
      });
    }
  }
});

export const updateAdminProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Şifre en az 8 karakter olmalı").optional(),
});

export type UpdateAdminProfileInput = z.infer<typeof updateAdminProfileSchema>;
