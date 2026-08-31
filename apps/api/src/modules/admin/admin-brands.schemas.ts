import { z } from "zod";

export const brandIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().min(1).max(100).regex(slugPattern, "Marka adresi sadece küçük harf, rakam ve tire içerebilir"),
});

export const updateBrandSchema = z.object({
  isActive: z.boolean().optional(),
});
