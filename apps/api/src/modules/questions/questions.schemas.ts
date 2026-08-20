import { z } from "zod";

export const createQuestionSchema = z.object({
  question: z.string().min(3).max(500),
});

export const answerQuestionSchema = z.object({
  answer: z.string().min(1).max(2000),
});

export const questionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
});
