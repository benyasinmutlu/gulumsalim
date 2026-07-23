import { z } from "zod";

// Oluşturma isteklerinde görsel multipart gövdede, diğer alanlar query
// string'de taşınır - tek bir multipart isteğinde hem dosya hem metin
// alanlarını güvenilir şekilde ayrıştırmak yerine bu daha basit yol
// tercih edildi.
export const createSliderQuerySchema = z.object({
  linkUrl: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  textColor: z.string().optional(),
  textPosition: z.enum(["left", "center", "right"]).optional(),
});

export const updateSliderSchema = z.object({
  linkUrl: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  textColor: z.string().optional(),
  textPosition: z.enum(["left", "center", "right"]).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createPromoBannerQuerySchema = z.object({
  title: z.string().min(1),
  linkUrl: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  textColor: z.string().optional(),
  rotateSeconds: z.coerce.number().int().positive().optional(),
});

export const updatePromoBannerSchema = z.object({
  title: z.string().min(1).optional(),
  linkUrl: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  textColor: z.string().optional(),
  rotateSeconds: z.coerce.number().int().positive().optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const contentIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
