import { z } from "zod";

export const customerListQuerySchema = z.object({
  search: z.string().optional(),
});
