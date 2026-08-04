import { CONFIDENCE, type FieldValue } from "../types";

const NAME_MAX = 200;
const DESC_MAX = 5000;

// Görünmez/kontrol karakterleri kod-noktasına göre siler (kaynak dosyada
// literal görünmez karakter / kırılgan \u kaçışı bulundurmamak için charCode
// ile). keepNewlineTab=true iken \t (9), \n (10), \r (13) korunur.
function stripControl(s: string, keepNewlineTab: boolean): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (keepNewlineTab && (c === 9 || c === 10 || c === 13)) {
      out += s[i];
      continue;
    }
    if (c <= 0x1f || c === 0x7f) continue; // C0 kontrol + DEL
    if (c === 0x200b || c === 0x200c || c === 0x200d || c === 0xfeff) continue; // zero-width + BOM
    out += s[i];
  }
  return out;
}

// Ürün adı: kontrol karakterlerini at, iç boşlukları tek boşluğa indir, kırp,
// uzunluk sınırı. Türkçe'yi bozmamak için harf büyüklüğü DEĞİŞTİRİLMEZ.
export function normalizeTitle(raw: string | undefined | null): FieldValue<string> {
  const input = raw ?? "";
  const cleaned = stripControl(input, false).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  if (!cleaned) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const neededCleanup = cleaned !== input.trim();
  return { value: cleaned, source: neededCleanup ? "rule" : "input", confidence: neededCleanup ? CONFIDENCE.CLEANED : CONFIDENCE.EXACT };
}

// Açıklama: kontrol karakterlerini at (satır sonu/tab korunur), satır sonu
// öncesi boşlukları at, 3+ boş satırı 2'ye indir, kırp, uzunluk sınırı.
export function cleanDescription(raw: string | undefined | null): FieldValue<string> {
  const input = raw ?? "";
  if (!input.trim()) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const cleaned = stripControl(input, true)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DESC_MAX);
  if (!cleaned) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  const neededCleanup = cleaned !== input.trim();
  return { value: cleaned, source: neededCleanup ? "rule" : "input", confidence: neededCleanup ? CONFIDENCE.CLEANED : CONFIDENCE.EXACT };
}

// Marka: kısa metin, kontrol karakter temizliği + kırpma. Boş -> null.
export function normalizeBrand(raw: string | undefined | null): FieldValue<string> {
  const cleaned = stripControl(raw ?? "", false).replace(/\s+/g, " ").trim().slice(0, 100);
  if (!cleaned) return { value: null, source: "input", confidence: CONFIDENCE.NONE };
  return { value: cleaned, source: "input", confidence: CONFIDENCE.EXACT };
}
