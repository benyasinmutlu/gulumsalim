import { z } from "zod";

export const createContactMessageSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  message: z.string().min(5).max(2000),
});

export const contactMessageIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
