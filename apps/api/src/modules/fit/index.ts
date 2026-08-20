import { bodyFromProfile, type FitProfileInput } from "./anthropometry";
import { fitConfigForCategory, matchFit, type FitResult, type ProductSizeChart } from "./fit-matcher";

// =============================================================================
// Fit-Zekâsı orkestratörü. Profil + ürün bedenleri + kategori → fit sonucu.
// Ölçü yoksa "no_measurements" (UI: profile beden/boy ekle), ürün bedeni yoksa
// "no_sizes". SAF: DB/ağ yok — çağıran profil+bedenleri sağlar (route).
// =============================================================================

export type FitOutcome =
  | { status: "ok"; result: FitResult; anchor: { size: number; source: string; confidence: number } }
  | { status: "no_measurements" }
  | { status: "no_sizes" };

export function computeFit(
  profile: FitProfileInput,
  productSizeLabels: string[],
  categoryText?: string | null,
  productChart?: ProductSizeChart,
): FitOutcome {
  const body = bodyFromProfile(profile);
  if (!body) return { status: "no_measurements" };
  const result = matchFit(body, productSizeLabels, fitConfigForCategory(categoryText), productChart);
  if (!result) return { status: "no_sizes" };
  return { status: "ok", result, anchor: { size: body.size, source: body.source, confidence: body.confidence } };
}

export * from "./size-chart";
export * from "./anthropometry";
export * from "./fit-matcher";
export * from "./feedback";
