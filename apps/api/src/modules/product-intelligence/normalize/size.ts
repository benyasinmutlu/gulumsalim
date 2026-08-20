// Beden metnini ("S,M,L" / "S/M/L" / "36 | 38") ayrı, normalize, tekilleştirilmiş
// bir listeye çevirir. Her beden bir varyanta karşılık gelir.

// Harf bedenleri büyük harfe sabitle (s -> S). Sayısal/karma bedenler olduğu
// gibi kalır (36, 4XL, "Tek Ebat"). TR yerel büyük harf (i -> İ değil; beden
// harflerinde sorun olmaz ama tutarlı olsun diye locale kullanılır).
const LETTER_SIZE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl)$/i;
export const MAX_PRODUCT_SIZES = 50;
export const MAX_SIZE_LABEL_LENGTH = 30;

export function normalizeSizes(raw: string | undefined | null): string[] {
  const input = (raw ?? "").trim();
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,/;|]/)) {
    const token = part.trim().replace(/\s+/g, " ");
    if (!token) continue;
    if (token.length > MAX_SIZE_LABEL_LENGTH || out.length >= MAX_PRODUCT_SIZES) continue;
    const normalized = LETTER_SIZE.test(token) ? token.toUpperCase() : token;
    const key = normalized.toLocaleLowerCase("tr");
    if (seen.has(key)) continue; // tekilleştir (S, s, " S " -> tek "S")
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

// "Bedenime uygun" filtresi için beden tipi - komşu (±1) adımı tipe göre
// değişir: ayakkabı 37-38-39 (adım 1), kadın sayısal 38-40-42 (adım 2).
export type SizeKind = "kadinBeden" | "ayakkabiNo" | "cocukBeden";

// Harf beden merdiveni (bir alt/bir üst için sıralı). 2XL/3XL -> XXL/XXXL.
const LETTER_LADDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const LETTER_ALIAS: Record<string, string> = { "2XL": "XXL", "3XL": "XXXL" };

function ladderIndexOf(token: string): number {
  return LETTER_LADDER.indexOf(LETTER_ALIAS[token] ?? token);
}

// Bir bedenin "bir alt + kendisi + bir üst" komşularını döner. Harf bedende
// merdiven, saf sayısal bedende tipe göre adım. Tanınmayan format ("5-6 yaş",
// "Tek Ebat") komşu üretmez, sadece kendini döner (güvenli fallback).
export function sizeNeighbors(raw: string, kind: SizeKind): string[] {
  const size = (raw ?? "").trim();
  if (!size) return [];

  const li = ladderIndexOf(size.toUpperCase());
  if (li >= 0) {
    return [LETTER_LADDER[li - 1], LETTER_LADDER[li], LETTER_LADDER[li + 1]].filter((s): s is string => !!s);
  }

  if (/^\d+$/.test(size)) {
    const n = Number(size);
    const step = kind === "kadinBeden" ? 2 : 1;
    return [n - step, n, n + step].filter((x) => x > 0).map(String);
  }

  return [size];
}
