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

export type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>;
export type VendorLoginInput = z.infer<typeof vendorLoginSchema>;
