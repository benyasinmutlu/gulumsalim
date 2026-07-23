import type { Category } from "./types";

// bkz. kullanıcı isteği: "tümünü gör sayfalarının arka planında başlığa
// özel hareketli ikonlar olsun" - kategorilerin admin panelden atanmış
// gerçek bir ikonu (category.icon) varsa o kullanılır, yoksa isme göre
// makul bir eşleşme (site şu an hiçbir kategoriye ikon atamamış, bu
// yüzden anahtar kelime eşlemesi olmadan özellik hiçbir şey göstermezdi).
const KEYWORD_ICONS: { keywords: string[]; icon: string }[] = [
  { keywords: ["elbise"], icon: "fa-person-dress" },
  { keywords: ["bluz", "gomlek", "gömlek", "tisort", "tişört"], icon: "fa-shirt" },
  { keywords: ["ust-giyim", "üst giyim", "ceket", "mont", "kaban"], icon: "fa-vest" },
  { keywords: ["alt-giyim", "pantolon", "etek", "sort", "şort"], icon: "fa-socks" },
  { keywords: ["dis-giyim", "dış giyim"], icon: "fa-cloud-showers-heavy" },
  { keywords: ["ayakkabi", "ayakkabı", "bot", "sandalet"], icon: "fa-shoe-prints" },
  { keywords: ["canta", "çanta"], icon: "fa-bag-shopping" },
  { keywords: ["aksesuar", "taki", "takı", "kolye", "yuzuk", "yüzük"], icon: "fa-gem" },
];

export function categoryIcon(category: Pick<Category, "icon" | "name" | "slug">): string {
  if (category.icon) return category.icon;
  const haystack = `${category.name.toLocaleLowerCase("tr-TR")} ${category.slug}`;
  for (const entry of KEYWORD_ICONS) {
    if (entry.keywords.some((k) => haystack.includes(k))) return entry.icon;
  }
  return "fa-tshirt";
}

const SECTION_ICONS: Record<string, string> = {
  manual: "fa-layer-group",
  featured: "fa-star",
  new_arrivals: "fa-sparkles",
  best_sellers: "fa-fire",
  weekly_best: "fa-trophy",
  vendor_carousel: "fa-store",
  vendor_products: "fa-store",
  promo_banners: "fa-tag",
  recently_viewed: "fa-clock-rotate-left",
  related_viewed: "fa-clock-rotate-left",
  discover_personalized: "fa-wand-magic-sparkles",
};

export function sectionIcon(algoType: string): string {
  return SECTION_ICONS[algoType] ?? "fa-bag-shopping";
}
