import type { DiscoverProfile } from "./pipeline";
import { sizeNeighbors, type SizeKind } from "../../product-intelligence/normalize/size";
import type { SizePrefs } from "../../../db/schema/customers";

// =============================================================================
// Customer Profile Builder (FAZ A) — kalıcı davranış sinyallerinden (favoriler +
// satın almalar) kişisel affinity profili üretir. SAF fonksiyon: satırları alır,
// DiscoverProfile döner (DB erişimi adapter'da, bkz. discover.repository.ts).
// Feature hydration (pipeline.hydrateFeatures) bu profili tüketir.
// =============================================================================

export interface InteractionRow {
  productId: number;
  vendorId: number;
  categoryId: number;
  brand: string | null;
  price: number;
  weight: number; // etkileşim gücü (satın alma > favori)
  createdAt: number; // ms — recentProductIds sıralaması için
}

// Etkileşim ağırlıkları — satın alma en güçlü niyet sinyali.
export const PURCHASE_WEIGHT = 3;
export const FAVORITE_WEIGHT = 2;

const TOP_CATEGORIES = 8;
const RECENT_PRODUCTS = 30;
// Fiyat bandı için uçları buda (aykırı tek pahalı/ucuz alım bandı bozmasın).
const PRICE_LOW_PCT = 0.1;
const PRICE_HIGH_PCT = 0.9;

function addWeight<K>(map: Map<K, number>, key: K, w: number): void {
  map.set(key, (map.get(key) ?? 0) + w);
}

// 0..1'e normalize (max'a böl). hydration categoryWeights/brandWeights'i
// normFromMap ile kendisi normalize eder → onları HAM bırakıyoruz; ama
// vendorQuality doğrudan (clamp01) okunuyor → burada normalize ediyoruz.
function normalizeMap<K>(map: Map<K, number>): Map<K, number> {
  let max = 0;
  for (const v of map.values()) if (v > max) max = v;
  if (max <= 0) return new Map(map);
  const out = new Map<K, number>();
  for (const [k, v] of map) out.set(k, v / max);
  return out;
}

function priceBand(prices: number[]): { min: number; max: number } {
  const xs = prices.filter((p) => p > 0).sort((a, b) => a - b);
  if (xs.length === 0) return { min: 0, max: 0 };
  const lo = xs[Math.min(xs.length - 1, Math.floor(xs.length * PRICE_LOW_PCT))]!;
  const hi = xs[Math.max(0, Math.ceil(xs.length * PRICE_HIGH_PCT) - 1)]!;
  return { min: lo, max: Math.max(hi, lo) };
}

export function buildProfileFromInteractions(rows: InteractionRow[]): DiscoverProfile {
  const categoryWeights = new Map<number, number>();
  const brandWeights = new Map<string, number>();
  const vendorWeights = new Map<number, number>();
  const knownBrands = new Set<string>();
  const prices: number[] = [];

  for (const r of rows) {
    addWeight(categoryWeights, r.categoryId, r.weight);
    addWeight(vendorWeights, r.vendorId, r.weight);
    if (r.brand) {
      addWeight(brandWeights, r.brand, r.weight);
      knownBrands.add(r.brand);
    }
    if (r.price > 0) prices.push(r.price);
  }

  const { min, max } = priceBand(prices);
  const topCategoryIds = [...categoryWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CATEGORIES)
    .map(([id]) => id);
  const recentProductIds = [...rows]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_PRODUCTS)
    .map((r) => r.productId);

  return {
    topCategoryIds,
    recentProductIds,
    knownBrands,
    categoryWeights, // HAM — hydration normFromMap ile normalize eder
    brandWeights, // HAM
    colorWeights: new Map(), // ürün seviyesinde renk yok (variant.color) — sonraki faz
    priceMin: min,
    priceMax: max,
    hiddenProductIds: new Set(), // negatif geri bildirim tablosu yok (Faz C)
    notInterestedCategoryIds: new Set(),
    vendorQuality: normalizeMap(vendorWeights), // 0..1 — doğrudan okunuyor
  };
}

// Kullanıcının profildeki bedenlerini + ±1 komşularını tek, küçük-harf normalize
// bir listeye açar (sizeFit eşleşmesi için). Beden motoruyla (sizeNeighbors)
// aynı merdiveni kullanır → beden filtresiyle tutarlı.
export function expandSizePrefs(prefs: SizePrefs | null | undefined): string[] {
  if (!prefs) return [];
  const out = new Set<string>();
  const add = (raw: string, kind: SizeKind) => {
    for (const n of sizeNeighbors(raw, kind)) out.add(n.toLowerCase());
  };
  for (const s of prefs.kadinBeden ?? []) add(s, "kadinBeden");
  for (const n of prefs.ayakkabiNo ?? []) add(String(n), "ayakkabiNo");
  for (const s of prefs.cocukBeden ?? []) add(s, "cocukBeden");
  return [...out];
}
