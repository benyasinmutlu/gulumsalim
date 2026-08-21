import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "../../lib/contact-info-detector";

export const supportChatSchema = z.object({
  message: z.string().min(1).max(1000).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(1000),
      }),
    )
    .max(10)
    .optional(),
});
