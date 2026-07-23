import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
