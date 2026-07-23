import { z } from "zod";

export const vendorStatusFilterSchema = z.object({
  status: z.enum(["pending", "active", "suspended", "banned"]).optional(),
});

export const updateVendorStatusSchema = z.object({
  action: z.enum(["approve", "activate", "suspend", "ban"]),
});

export const vendorIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
