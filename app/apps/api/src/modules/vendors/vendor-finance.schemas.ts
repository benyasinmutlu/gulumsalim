import { z } from "zod";

export const requestPayoutSchema = z.object({
  amount: z.coerce.number().min(50),
  iban: z.string().min(15).max(34),
  note: z.string().optional(),
});
