import { CONFIDENCE, type FieldValue, type NormalizedProduct } from "../../types";
import type { EnrichmentContext, EnrichmentProvider } from "./provider";

// RULE katmanı: heuristik (anahtar-kelime) öneriler. HEP açık, hızlı, deterministik.
// AI/ML kapalıyken sistemin öneri üretmesini garanti eder (graceful degradation).

// Başlık anahtar kelimesi -> kategori slug'ı. Slug DB'de yoksa resolveCategory
// null döner ve öneri yapılmaz (güvenli).
const CATEGORY_KEYWORDS: { pattern: RegExp; slug: string }[] = [
  { pattern: /\belbise\b/i, slug: "elbise" },
  { pattern: /\b(g[öo]mlek|bluz)\b/i, slug: "gomlek" },
  { pattern: /\b(pantolon|jean|kot)\b/i, slug: "pantolon" },
  { pattern: /\b(etek)\b/i, slug: "etek" },
  { pattern: /\b(ceket|mont|kaban)\b/i, slug: "dis-giyim" },
  { pattern: /\b(t-?shirt|ti[sş][öo]rt|tishort)\b/i, slug: "tisort" },
  { pattern: /\b(ayakkab[ıi]|bot|topuklu|sneaker)\b/i, slug: "ayakkabi" },
  { pattern: /\b([cç]anta)\b/i, slug: "canta" },
  { pattern: /\b([sş]al|fular|e[sş]arp)\b/i, slug: "aksesuar" },
];

// Nitelik anahtar kelimeleri (başlıktan çıkarım). renk/materyal/desen.
const COLOR_WORDS = ["siyah", "beyaz", "kırmızı", "mavi", "yeşil", "sarı", "mor", "pembe", "lacivert", "bej", "gri", "kahverengi", "turuncu", "bordo"];
const MATERIAL_WORDS = ["pamuk", "keten", "kot", "deri", "kadife", "saten", "ipek", "yün", "polyester", "viskon"];
const PATTERN_WORDS = ["çiçekli", "çizgili", "puantiyeli", "ekose", "leopar", "desenli", "düz"];

function matchWord(haystack: string, words: string[]): string | undefined {
  const lower = haystack.toLocaleLowerCase("tr");
  return words.find((w) => lower.includes(w));
}

export const ruleProvider: EnrichmentProvider = {
  name: "rule",
  priority: 2, // en son (ai/ml denendikten sonra fallback)
  isEnabled: () => true,

  async suggestCategory(p: NormalizedProduct, ctx: EnrichmentContext): Promise<FieldValue<number> | null> {
    if (p.categoryId.value) return null; // zaten kategori var, öneriye gerek yok
    const name = p.name.value ?? "";
    for (const { pattern, slug } of CATEGORY_KEYWORDS) {
      if (pattern.test(name)) {
        const id = await ctx.resolveCategory(slug);
        if (id != null) return { value: id, source: "rule", confidence: 0.6 };
      }
    }
    return null;
  },

  async extractAttributes(p: NormalizedProduct): Promise<Record<string, string>> {
    const text = `${p.name.value ?? ""} ${p.description.value ?? ""}`;
    const attrs: Record<string, string> = {};
    const color = matchWord(text, COLOR_WORDS);
    if (color) attrs.renk = color;
    const material = matchWord(text, MATERIAL_WORDS);
    if (material) attrs.materyal = material;
    const pattern = matchWord(text, PATTERN_WORDS);
    if (pattern) attrs.desen = pattern;
    return attrs;
  },

  async generateDescription(p: NormalizedProduct): Promise<FieldValue<string> | null> {
    if (p.description.value) return null; // zaten açıklama var
    const name = p.name.value;
    if (!name) return null;
    // Basit şablon (AI gelince gerçek üretim onun işi). Düşük güven.
    const brand = p.brand.value ? `${p.brand.value} ` : "";
    const sizes = p.sizes.length ? ` ${p.sizes.join(", ")} bedenleriyle.` : "";
    const text = `${brand}${name}.${sizes}`.trim();
    return { value: text, source: "rule", confidence: CONFIDENCE.NONE + 0.3 };
  },
};
