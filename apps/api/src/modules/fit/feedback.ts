import { measurementsForSize, type BodyMeasure } from "./size-chart";
import type { ProductSizeChart } from "./fit-matcher";

// =============================================================================
// Fit-Zekâsı Faz 5 — ÖĞRENEN KATMAN (deterministik, ML-öncesi).
// Müşteri geri bildirimi ("geldi: dar/tam/bol") + iadeler → ürünün her bedeni
// için ölçü kayması (cm) çıkarır. Bu kayma, satıcı tablosu YOKSA devreye giren
// "öğrenilmiş kalıp" olur; matchFit'in productChart'ı olarak beslenir.
//
// Sinyal yönü: bir beden "DAR geldi" ise, o giysi standarttan KÜÇÜK demektir →
// ölçüleri aşağı kaydır (sistem bir üst bedeni önersin). "BOL" ise yukarı.
// SAF: DB yok — çağıran (repository) satırları toplayıp buraya verir.
// =============================================================================

export type FitVerdict = "cok_dar" | "dar" | "tam" | "bol" | "cok_bol";

export const FIT_VERDICTS: readonly FitVerdict[] = ["cok_dar", "dar", "tam", "bol", "cok_bol"];

export function isFitVerdict(v: unknown): v is FitVerdict {
  return typeof v === "string" && (FIT_VERDICTS as readonly string[]).includes(v);
}

// Karar → giysi ölçüsü düzeltmesi (cm). Dar geldi = giysi küçük = negatif kayma.
const VERDICT_DELTA_CM: Record<FitVerdict, number> = {
  cok_dar: -3,
  dar: -1.5,
  tam: 0,
  bol: 1.5,
  cok_bol: 3,
};

export function verdictToDeltaCm(v: FitVerdict): number {
  return VERDICT_DELTA_CM[v];
}

// Öğrenmenin güvenmesi için beden başına asgari örnek (altında yok sayılır —
// tek kişinin "dar" demesi kalıbı değiştirmesin).
export const MIN_SAMPLES_PER_SIZE = 3;

export interface FeedbackRow {
  sizeNumeric: number; // satın alınan beden (numaraya çevrilmiş)
  verdict: FitVerdict;
}

// Beden numarası → öğrenilmiş ölçü kayması (cm). Yalnız yeterli örneği olan
// bedenler döner (ortalama delta; |delta|<0.5 ise gürültü kabul edilir, atlanır).
export function aggregateFeedback(rows: FeedbackRow[]): Record<number, number> {
  const buckets = new Map<number, number[]>();
  for (const r of rows) {
    if (!isFitVerdict(r.verdict) || !Number.isFinite(r.sizeNumeric)) continue;
    const arr = buckets.get(r.sizeNumeric) ?? [];
    arr.push(verdictToDeltaCm(r.verdict));
    buckets.set(r.sizeNumeric, arr);
  }
  const out: Record<number, number> = {};
  for (const [size, deltas] of buckets) {
    if (deltas.length < MIN_SAMPLES_PER_SIZE) continue;
    const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    if (Math.abs(mean) < 0.5) continue; // istatistiksel gürültü
    out[size] = Math.round(mean * 10) / 10;
  }
  return out;
}

// Öğrenilmiş kaymaları, standart ölçülere uygulanmış bir ProductSizeChart'a
// çevirir (her boyut standart + delta). matchFit'e productChart olarak verilir.
export function learnedChart(deltas: Record<number, number>): ProductSizeChart | undefined {
  const out: ProductSizeChart = {};
  for (const [sizeStr, delta] of Object.entries(deltas)) {
    const size = Number(sizeStr);
    const std = measurementsForSize(size);
    if (!std || delta === 0) continue;
    const m: Partial<BodyMeasure> = {};
    for (const d of ["bust", "waist", "hip"] as const) m[d] = Math.round((std[d] + delta) * 10) / 10;
    out[size] = m;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Satıcının ölçtüğü tablo (kesin) ile öğrenilmiş tabloyu birleştirir. Satıcı
// AÇIKÇA girdiği boyut kazanır; girmediği boyut için öğrenilmiş değer devreye
// girer; ikisi de yoksa matchFit standarda düşer. Boyut-bazında birleştirme.
export function mergeCharts(
  learned: ProductSizeChart | undefined,
  vendor: ProductSizeChart | undefined,
): ProductSizeChart | undefined {
  if (!learned) return vendor;
  if (!vendor) return learned;
  const out: ProductSizeChart = {};
  const sizes = new Set<number>([...Object.keys(learned), ...Object.keys(vendor)].map(Number));
  for (const n of sizes) out[n] = { ...(learned[n] ?? {}), ...(vendor[n] ?? {}) };
  return out;
}
