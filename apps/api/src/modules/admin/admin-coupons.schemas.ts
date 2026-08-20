import { z } from "zod";

export const couponIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const createCouponSchema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, "Kupon kodu sadece harf, rakam, - ve _ içerebilir"),
  type: z.enum(["percent", "fixed"]),
  value: z.number().positive(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerCustomer: z.number().int().positive().default(1),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateCouponSchema = z.object({
  type: z.enum(["percent", "fixed"]).optional(),
  value: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().nullable().optional(),
  maxUsesTotal: z.number().int().positive().nullable().optional(),
  maxUsesPerCustomer: z.number().int().positive().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});
