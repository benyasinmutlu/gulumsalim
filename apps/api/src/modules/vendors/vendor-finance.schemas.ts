import { z } from "zod";
import { isValidTurkishIban, normalizeIban } from "../../lib/iban";

const payoutAmountSchema = z.coerce
  .number()
  .finite("Tutar geçerli bir sayı olmalı")
  .min(50, "Minimum ödeme talebi 50 TL'dir")
  .max(99_999_999.99, "Tutar izin verilen sınırı aşıyor")
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Tutar en fazla iki ondalık basamak içerebilir");

export const requestPayoutSchema = z.object({
  amount: payoutAmountSchema,
  iban: z.string().transform(normalizeIban).refine(isValidTurkishIban, "Geçerli bir Türkiye IBAN'ı giriniz"),
  accountHolder: z.string().trim().min(2, "Hesap sahibi gerekli").max(120),
  note: z.string().trim().max(500).optional(),
});
