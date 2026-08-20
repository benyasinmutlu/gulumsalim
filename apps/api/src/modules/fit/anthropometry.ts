import { AVAILABLE_SIZES, measurementsForSize, nearestAvailableSize, sizeLabelToNumeric, type BodyMeasure } from "./size-chart";

// =============================================================================
// Profil → vücut ölçüsü proxy'si. Anchor = kullanıcının HER ZAMANKİ bedeni
// (sizePrefs.kadinBeden). Boy/kilo (BMI) ile hafif rafine edilir. Beden yoksa
// BMI'den kaba tahmin (düşük güven). SAF: yan etki yok, test edilebilir.
// =============================================================================

export interface FitProfileInput {
  kadinBeden?: string[];
  heightCm?: number | null;
  weightKg?: number | null;
}

export interface BodyProxy extends BodyMeasure {
  size: number; // anchor beden (numara)
  heightCm: number | null;
  bmi: number | null;
  source: "usual_size" | "estimated";
  confidence: number; // 0..1
}

export const REFERENCE_HEIGHT_CM = 168; // tablonun tipik boyu (boy/oran notu için)

function round1(n: number): number { return Math.round(n * 10) / 10; }
function clamp(n: number, lo: number, hi: number): number { return n < lo ? lo : n > hi ? hi : n; }
function roundToSize(n: number): number { return nearestAvailableSize(Math.round(n / 2) * 2); }

// Beden için "beklenen" ortalama BMI — 34≈19 … 46≈28 (lineer, adım 0.75).
export function expectedBmiForSize(size: number): number {
  return 19 + (size - 34) * 0.75;
}
function estimateSizeFromBmi(bmi: number): number {
  return roundToSize(34 + (bmi - 19) / 0.75);
}

export function bodyFromProfile(p: FitProfileInput): BodyProxy | null {
  const heightCm = p.heightCm ?? null;
  const weightKg = p.weightKg ?? null;
  const bmi = heightCm && weightKg && heightCm > 0 ? weightKg / Math.pow(heightCm / 100, 2) : null;

  // 1) Anchor: her zamanki beden(ler)in ortalaması
  const usual = (p.kadinBeden ?? []).map(sizeLabelToNumeric).filter((x): x is number => x != null);
  let size: number;
  let source: BodyProxy["source"];
  let confidence: number;
  if (usual.length > 0) {
    size = roundToSize(usual.reduce((a, b) => a + b, 0) / usual.length);
    source = "usual_size";
    confidence = 0.8;
  } else if (bmi != null) {
    size = estimateSizeFromBmi(bmi);
    source = "estimated";
    confidence = 0.45;
  } else {
    return null; // ne beden ne boy/kilo → fit hesaplanamaz
  }

  const base = measurementsForSize(size)!;
  let { bust, waist, hip } = base;

  // 2) BMI rafinasyonu: bedene "beklenen" BMI'den sapma → ölçüyü hafif kaydır
  //    (bel en duyarlı). Uçlarda güveni bir miktar düşür.
  if (bmi != null) {
    const delta = clamp(bmi - expectedBmiForSize(size), -4, 4);
    waist += delta * 0.6;
    bust += delta * 0.42;
    hip += delta * 0.42;
    if (Math.abs(delta) > 2.5) confidence *= 0.9;
  }

  return {
    size,
    bust: round1(bust),
    waist: round1(waist),
    hip: round1(hip),
    heightCm,
    bmi: bmi != null ? round1(bmi) : null,
    source,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export { AVAILABLE_SIZES };
