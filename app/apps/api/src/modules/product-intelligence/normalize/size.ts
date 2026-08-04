// Beden metnini ("S,M,L" / "S/M/L" / "36 | 38") ayrı, normalize, tekilleştirilmiş
// bir listeye çevirir. Her beden bir varyanta karşılık gelir.

// Harf bedenleri büyük harfe sabitle (s -> S). Sayısal/karma bedenler olduğu
// gibi kalır (36, 4XL, "Tek Ebat"). TR yerel büyük harf (i -> İ değil; beden
// harflerinde sorun olmaz ama tutarlı olsun diye locale kullanılır).
const LETTER_SIZE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl)$/i;

export function normalizeSizes(raw: string | undefined | null): string[] {
  const input = (raw ?? "").trim();
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,/;|]/)) {
    const token = part.trim().replace(/\s+/g, " ");
    if (!token) continue;
    const normalized = LETTER_SIZE.test(token) ? token.toUpperCase() : token;
    const key = normalized.toLocaleLowerCase("tr");
    if (seen.has(key)) continue; // tekilleştir (S, s, " S " -> tek "S")
    seen.add(key);
    out.push(normalized);
  }
  return out;
}
