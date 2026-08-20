import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { fitFeedback } from "../../db/schema/catalog";
import type { FeedbackRow, FitVerdict } from "./feedback";

// =============================================================================
// Fit-Zekâsı Faz 5 veri katmanı. Geri bildirim yazma + ürün için toplama.
// Saf öğrenme mantığı feedback.ts'te; burası sadece DB I/O (append-only).
// =============================================================================

export interface RecordFitFeedbackInput {
  productId: number;
  customerId: number | null;
  sizeNumeric: number;
  verdict: FitVerdict;
  source?: "explicit" | "return";
}

export async function recordFitFeedback(input: RecordFitFeedbackInput): Promise<void> {
  await db.insert(fitFeedback).values({
    productId: input.productId,
    customerId: input.customerId,
    sizeNumeric: input.sizeNumeric,
    verdict: input.verdict,
    source: input.source ?? "explicit",
  });
}

// Bir ürünün öğrenme için tüm geri bildirim satırları (beden + karar).
export async function getProductFeedbackRows(productId: number): Promise<FeedbackRow[]> {
  const rows = await db
    .select({ sizeNumeric: fitFeedback.sizeNumeric, verdict: fitFeedback.verdict })
    .from(fitFeedback)
    .where(eq(fitFeedback.productId, productId));
  return rows.map((r) => ({ sizeNumeric: r.sizeNumeric, verdict: r.verdict as FitVerdict }));
}
