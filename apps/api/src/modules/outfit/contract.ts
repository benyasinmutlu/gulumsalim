// =============================================================================
// Outfit / Kombin Engine — Domain & Rule Interface (FAZ 5, iskelet)
// =============================================================================
// İlk sürüm kurallı (embedding YOK): renk uyumu + kategori tamamlayıcılığı +
// mevsim + stok. Açıklanabilir ("neden bu kombin"). Saf fonksiyonlar → test
// edilebilir. Gerekçe ve evrim: docs/architecture/outfit-engine.md.

export type GarmentSlot = "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory";
export type Season = "spring" | "summer" | "autumn" | "winter" | "all";

export interface Garment {
  productId: number;
  vendorId: number;
  slot: GarmentSlot;
  colorFamily: string; // "black","white","blue",...
  season: Season;
  style?: string; // "casual","elegant",...
  inStock: boolean;
}

export interface OutfitSuggestion {
  items: number[]; // productId'ler
  score: number;
  reasons: string[]; // "neden bu kombin" açıklaması
}

export interface OutfitRuleEngine {
  suggest(seed: Garment, catalog: Garment[], opts: OutfitRuleOptions): OutfitSuggestion[];
}

export interface OutfitRuleOptions {
  limit: number;
  season?: Season;
}

// Nötrler her renkle uyumlu; aynı renk uyumlu; aksi halde temel bir uyum tablosu.
const NEUTRALS = new Set(["black", "white", "gray", "grey", "beige", "denim"]);
const COMPLEMENT: Record<string, string[]> = {
  blue: ["white", "beige", "gray"],
  red: ["black", "white"],
  green: ["beige", "white"],
  pink: ["white", "gray"],
};

export function colorsHarmonize(a: string, b: string): boolean {
  if (a === b) return true;
  if (NEUTRALS.has(a) || NEUTRALS.has(b)) return true;
  return (COMPLEMENT[a]?.includes(b) ?? false) || (COMPLEMENT[b]?.includes(a) ?? false);
}

function seasonCompatible(a: Season, b: Season): boolean {
  return a === "all" || b === "all" || a === b;
}

// seed bir "top" ise onu bir "bottom" + "shoes" ile tamamlar (basit kural).
// Genişletilebilir; ilk sürümde temel bir üçlü kombin.
const COMPLEMENTARY_SLOTS: Partial<Record<GarmentSlot, GarmentSlot[]>> = {
  top: ["bottom", "shoes"],
  bottom: ["top", "shoes"],
  dress: ["shoes", "outerwear"],
  outerwear: ["top", "bottom"],
  shoes: ["top", "bottom"],
};

export function ruleBasedEngine(): OutfitRuleEngine {
  return {
    suggest(seed, catalog, opts) {
      const wantedSlots = COMPLEMENTARY_SLOTS[seed.slot] ?? [];
      const season = opts.season ?? seed.season;

      // Her tamamlayıcı slot için en uyumlu adayı deterministik seç.
      const picks: { garment: Garment; reasons: string[]; score: number }[] = [];
      for (const slot of wantedSlots) {
        const candidates = catalog
          .filter((g) => g.slot === slot && g.inStock && g.productId !== seed.productId)
          .filter((g) => seasonCompatible(g.season, season))
          .map((g) => {
            const reasons: string[] = [];
            let score = 0;
            if (colorsHarmonize(seed.colorFamily, g.colorFamily)) {
              score += 0.6;
              reasons.push(`Renk uyumu: ${seed.colorFamily} + ${g.colorFamily}`);
            }
            if (seed.style && g.style && seed.style === g.style) {
              score += 0.3;
              reasons.push(`Stil uyumu: ${g.style}`);
            }
            reasons.push(`Mevsim uygun: ${g.season}`);
            score += 0.1;
            return { garment: g, reasons, score };
          })
          .filter((c) => c.score >= 0.6) // en azından renk uyumu şart
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.garment.productId - a.garment.productId));

        if (candidates[0]) picks.push(candidates[0]);
      }

      if (picks.length < wantedSlots.length) return []; // eksik slot → kombin önerme
      const suggestion: OutfitSuggestion = {
        items: [seed.productId, ...picks.map((p) => p.garment.productId)],
        score: picks.reduce((s, p) => s + p.score, 0) / picks.length,
        reasons: picks.flatMap((p) => p.reasons),
      };
      return [suggestion].slice(0, opts.limit);
    },
  };
}
