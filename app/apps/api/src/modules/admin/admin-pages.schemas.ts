import { z } from "zod";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createPageSchema = z.object({
  slug: z.string().min(1).regex(slugPattern, "Sayfa adresi sadece küçük harf, rakam ve tire içerebilir"),
  title: z.string().min(1),
  content: z.string().min(1),
  showInFooter: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updatePageSchema = z.object({
  slug: z.string().min(1).regex(slugPattern).optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  showInFooter: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const pageIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
