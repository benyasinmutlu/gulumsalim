import { measurementsForSize, numericToLetter, sizeLabelToNumeric, type BodyMeasure } from "./size-chart";
import { REFERENCE_HEIGHT_CM, type BodyProxy } from "./anthropometry";

// Satıcının ürüne-özel beden tablosu (Faz 4): beden numarası → (kısmi) ölçüler.
// Verilen boyut standart tabloyu EZER (kalıp küçük/büyük farkı buradan gelir).
// Örn { 38: { bust: 86 } } → bu ürünün M'i standart 90 yerine 86 = dar kalıp.
export type ProductSizeChart = Record<number, Partial<BodyMeasure>>;

// =============================================================================
// Vücut proxy'si ↔ ürün bedenleri → beden önerisi + boyut-boyut fit + güven.
// SAF/deterministik. "Kalıp" farkı ileride ürüne-özel tablo ile gelir; v1
// standart tabloyla çalışır (öneri + boy/oran notu yine değerli).
// =============================================================================

export type Dimension = "bust" | "waist" | "hip";
export type FitStatus = "tight" | "fits" | "loose";
export type LengthStatus = "short" | "ok" | "long";

export interface DimensionFit {
  dimension: Dimension;
  status: FitStatus;
  deltaCm: number; // vücut - giysi (poz = giysi dar)
}

export interface FitResult {
  recommendedSize: string; // ürün etiketiyle (ör. "M" veya "40")
  recommendedSizeNumeric: number;
  alternativeSize?: string;
  dimensions: DimensionFit[];
  lengthNote: LengthStatus | null;
  score: number; // 0..100 güven
  reasons: string[]; // makine-okur kodlar (UI metni istemcide)
}

export interface FitCategoryConfig {
  dims: Dimension[];
  hasLength: boolean;
}

// Kategori adı/slug'ından hangi ölçülerin önemli olduğunu çıkarır (TR anahtar).
export function fitConfigForCategory(categoryText: string | null | undefined): FitCategoryConfig {
  const t = (categoryText ?? "").toLocaleLowerCase("tr");
  const has = (...k: string[]) => k.some((x) => t.includes(x));
  if (has("elbise", "tunik", "abiye", "tulum", "gecelik")) return { dims: ["bust", "waist", "hip"], hasLength: true };
  if (has("pantolon", "etek", "tayt", "şort", "sort", "jean", "kot", "alt giyim")) return { dims: ["waist", "hip"], hasLength: true };
  if (has("gömlek", "gomlek", "bluz", "tişört", "tisort", "kazak", "triko", "sweat", "ceket", "mont", "hırka", "hirka", "büstiyer", "body", "üst giyim")) {
    return { dims: ["bust", "waist"], hasLength: false };
  }
  return { dims: ["bust", "waist", "hip"], hasLength: false };
}

// Satıcının etiketle sakladığı tabloyu ({ "M": {bust:86} }) numara anahtarlı +
// temizlenmiş ProductSizeChart'a çevirir (geçersiz/boş alanlar atılır).
export function normalizeProductChart(raw: Record<string, Partial<BodyMeasure>> | null | undefined): ProductSizeChart | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: ProductSizeChart = {};
  for (const [label, m] of Object.entries(raw)) {
    const n = sizeLabelToNumeric(label);
    if (n == null || !m || typeof m !== "object") continue;
    const clean: Partial<BodyMeasure> = {};
    for (const d of ["bust", "waist", "hip"] as const) {
      const v = (m as Record<string, unknown>)[d];
      if (typeof v === "number" && v > 30 && v < 200) clean[d] = v;
    }
    if (Object.keys(clean).length > 0) out[n] = clean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const FIT_TOLERANCE_CM = 2; // ±2cm içinde "tam"; dışında dar/bol

function statusFor(deltaCm: number): FitStatus {
  if (deltaCm > FIT_TOLERANCE_CM) return "tight";
  if (deltaCm < -FIT_TOLERANCE_CM) return "loose";
  return "fits";
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

export function matchFit(
  body: BodyProxy,
  productSizeLabels: string[],
  config: FitCategoryConfig,
  productChart?: ProductSizeChart,
): FitResult | null {
  // Ürün bedenlerini numaraya çevir + benzersiz.
  const seen = new Set<number>();
  const sizes: { label: string; n: number }[] = [];
  for (const label of productSizeLabels) {
    const n = sizeLabelToNumeric(label);
    if (n == null || seen.has(n)) continue;
    seen.add(n);
    sizes.push({ label, n });
  }
  if (sizes.length === 0) return null;

  const dims = config.dims;
  const bodyVal: Record<Dimension, number> = { bust: body.bust, waist: body.waist, hip: body.hip };

  // Bir bedenin GİYSİ ölçüsü: satıcı tablosu varsa onu, yoksa standardı (boyut
  // başına birleştirme — satıcı sadece göğüs girdiyse bel/kalça standart kalır).
  const garment = (n: number): BodyMeasure => ({ ...measurementsForSize(n)!, ...(productChart?.[n] ?? {}) });

  // Her ürün bedeni için ilgili ölçülerde ortalama mutlak sapma (küçük = iyi).
  const cost = (n: number): number => {
    const g = garment(n);
    let s = 0;
    for (const d of dims) s += Math.abs(bodyVal[d] - g[d]);
    return s / dims.length;
  };

  const ranked = [...sizes].sort((a, b) => cost(a.n) - cost(b.n));
  const best = ranked[0]!;
  const alt = ranked[1];

  const g = garment(best.n);
  const dimensions: DimensionFit[] = dims.map((d) => {
    const delta = round1(bodyVal[d] - g[d]);
    return { dimension: d, status: statusFor(delta), deltaCm: delta };
  });

  // Boy/oran notu (yalnız boyu olan kategoriler + boy bilgisi varsa).
  let lengthNote: LengthStatus | null = null;
  if (config.hasLength && body.heightCm != null) {
    const dh = body.heightCm - REFERENCE_HEIGHT_CM;
    lengthNote = dh > 6 ? "short" : dh < -6 ? "long" : "ok"; // uzun boy → giysi KISA gelebilir
  }

  // Güven skoru: profil güveni × öneri kalitesi (sapma az → yüksek).
  const meanAbsDelta = dimensions.reduce((s, x) => s + Math.abs(x.deltaCm), 0) / (dimensions.length || 1);
  const quality = clamp01(1 - meanAbsDelta / 6);
  const score = Math.round(100 * body.confidence * (0.5 + 0.5 * quality));

  const reasons: string[] = [`anchor_${body.source}`];
  for (const x of dimensions) if (x.status !== "fits") reasons.push(`${x.dimension}_${x.status}`);
  if (lengthNote && lengthNote !== "ok") reasons.push(`length_${lengthNote}`);

  return {
    recommendedSize: numericToLetter(best.n) ?? best.label,
    recommendedSizeNumeric: best.n,
    alternativeSize: alt ? (numericToLetter(alt.n) ?? alt.label) : undefined,
    dimensions,
    lengthNote,
    score,
    reasons,
  };
}
