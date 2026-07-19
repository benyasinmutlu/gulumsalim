import { z } from "zod";

export const requestPayoutSchema = z.object({
  amount: z.coerce.number().positive(),
  iban: z.string().min(15).max(34),
  note: z.string().optional(),
});
