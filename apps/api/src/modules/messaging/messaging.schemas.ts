import { z } from "zod";
import { CONTACT_INFO_MESSAGE, containsContactInfo } from "../../lib/contact-info-detector";

export const vendorIdParamsSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000).refine((v) => !containsContactInfo(v), CONTACT_INFO_MESSAGE),
});
