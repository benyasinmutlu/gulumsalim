import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(2000).optional(),
});

export const reviewIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(["approve", "reject", "unapprove"]),
});

export const reviewListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const replyToReviewSchema = z.object({
  reply: z.string().min(1).max(1000),
});
