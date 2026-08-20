// =============================================================================
// Standart kadın vücut ölçü tablosu (EN 13402, TR = EU/Alman numaraları).
// Değerler VÜCUT ölçüsü (cm), giysi değil. Beden adımı +4cm. Fit-Zekâsı bunu
// referans alır; ileride satıcı ürüne-özel tablo girerse override edilir.
// =============================================================================

export interface BodyMeasure {
  bust: number;
  waist: number;
  hip: number;
}

export const STANDARD_WOMEN_CHART: Readonly<Record<number, BodyMeasure>> = {
  34: { bust: 82, waist: 64, hip: 90 },
  36: { bust: 86, waist: 68, hip: 94 },
  38: { bust: 90, waist: 72, hip: 98 },
  40: { bust: 94, waist: 76, hip: 102 },
  42: { bust: 98, waist: 80, hip: 106 },
  44: { bust: 102, waist: 84, hip: 110 },
  46: { bust: 106, waist: 88, hip: 114 },
};

export const AVAILABLE_SIZES: number[] = Object.keys(STANDARD_WOMEN_CHART).map(Number).sort((a, b) => a - b);
const MIN_SIZE = AVAILABLE_SIZES[0]!;
const MAX_SIZE = AVAILABLE_SIZES[AVAILABLE_SIZES.length - 1]!;

const LETTER_TO_NUMERIC: Readonly<Record<string, number>> = {
  XXS: 32, XS: 34, S: 36, M: 38, L: 40, XL: 42, XXL: 44, XXXL: 46, "2XL": 44, "3XL": 46,
};

// Tabloya en yakın mevcut beden (aralık dışı numarayı sınıra çeker).
export function nearestAvailableSize(n: number): number {
  if (n <= MIN_SIZE) return MIN_SIZE;
  if (n >= MAX_SIZE) return MAX_SIZE;
  let best = MIN_SIZE;
  let bd = Infinity;
  for (const s of AVAILABLE_SIZES) {
    const d = Math.abs(s - n);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Beden etiketini ("S" / "38" / " m " / "40 EU") numaraya çevir. Tanınmazsa null.
export function sizeLabelToNumeric(label: string): number | null {
  const t = (label ?? "").trim().toUpperCase();
  if (!t) return null;
  const num = t.match(/\d{2}/);
  if (num) return nearestAvailableSize(Number(num[0]));
  return LETTER_TO_NUMERIC[t] ?? null;
}

export function measurementsForSize(size: number): BodyMeasure | null {
  return STANDARD_WOMEN_CHART[size] ?? STANDARD_WOMEN_CHART[nearestAvailableSize(size)] ?? null;
}

// Numarayı okunur harf/etikete çevir (öneri gösterimi için).
const NUMERIC_TO_LETTER: Readonly<Record<number, string>> = { 34: "XS", 36: "S", 38: "M", 40: "L", 42: "XL", 44: "XXL", 46: "3XL" };
export function numericToLetter(size: number): string | null {
  return NUMERIC_TO_LETTER[size] ?? null;
}
