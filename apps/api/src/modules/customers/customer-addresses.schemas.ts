import { z } from "zod";

export const addressBodySchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  city: z.string().min(2),
  district: z.string().min(2),
  addressLine: z.string().min(5),
  zipCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const addressIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
