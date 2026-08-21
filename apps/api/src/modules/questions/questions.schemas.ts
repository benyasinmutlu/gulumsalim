import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "../../lib/contact-info-detector";

export const createQuestionSchema = z.object({
  question: z.string().min(3).max(500).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE),
});

export const answerQuestionSchema = z.object({
  answer: z.string().min(1).max(2000).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE),
});

export const questionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  questionId: z.coerce.number().int().positive(),
});
