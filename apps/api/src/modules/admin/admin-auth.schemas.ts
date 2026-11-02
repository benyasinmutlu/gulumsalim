import { z } from "zod";

export const adminLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const adminMfaCodeSchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
