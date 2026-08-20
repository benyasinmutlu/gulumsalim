import { z } from "zod";

export const payoutStatusFilterSchema = z.object({
  status: z.enum(["pending", "paid", "rejected"]).optional(),
});

export const processPayoutSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional(),
    transferReference: z.string().trim().min(3).max(120).optional(),
  })
  .refine((data) => data.action !== "reject" || Boolean(data.reason), {
    path: ["reason"],
    message: "Red nedeni gerekli",
  })
  .refine((data) => data.action !== "approve" || Boolean(data.transferReference), {
    path: ["transferReference"],
    message: "Banka transfer/dekont referansı gerekli",
  });

export const payoutIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
