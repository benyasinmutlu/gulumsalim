import { getPublicSettings } from "../modules/content/content.repository";

export const DEFAULT_SHIPPING_FEE = 49.9;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 500;

// gulumsalim.com'daki admin/settings.php > Kargo sekmesinin karşılığı -
// admin panelden değiştirilebilir, hiç ayarlanmamışsa eski sabit
// değerlere düşer. Hem sepet (cart.service.ts) hem checkout
// (checkout.service.ts) AYNI hesaplamayı kullanır - daha önce checkout
// gerçek ücreti biliyordu ama sepet/ödeme sayfaları müşteriye hiç
// göstermiyordu (bkz. kullanıcı isteği: "kargo ücreti ne ise o yazsın").
// Admin panelden gelen ayar serbest metindir - hatalı bir değer ("abc",
// negatif, boş) girilirse Number() ile NaN'a düşüp SEPET/ÖDEME TOPLAMINI
// NaN yapabilirdi. Geçerli (sonlu, >= 0) değilse güvenle varsayılana düşülür.
function safePositiveNumber(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function getShippingConfig() {
  const rows = await getPublicSettings(["shipping_cost", "free_shipping_limit"]);
  const shippingFee = safePositiveNumber(rows.shipping_cost, DEFAULT_SHIPPING_FEE);
  const freeShippingThreshold = safePositiveNumber(rows.free_shipping_limit, DEFAULT_FREE_SHIPPING_THRESHOLD);
  return { shippingFee, freeShippingThreshold };
}

// Satıcı-bazlı kargo (kullanıcı kararı 2026-08-03: "her satıcının kargosu için
// ayrı ödeme alınmalı, çoklu-satıcılı sepette dahi tek kargo ücreti olmaz").
// Çoklu-satıcılı sepette her DİSTİNCT satıcı için AYRI kargo ücreti hesaplanır.
// Bir satıcının kargosu, o satıcıdan alınan ürünlerin toplamı ücretsiz-kargo
// eşiğini geçerse VEYA o satıcının tüm ürünleri freeShipping ise sıfırlanır -
// yani "500₺ üstü ücretsiz" artık SATICI BAŞINA çalışır. Toplam kargo = ücret
// ödenen satıcıların kargo ücretleri toplamı. Sepet (cart.service) ve checkout
// bu TEK fonksiyonu kullanır - hesap birebir aynı kalsın diye.
export interface VendorShippingLine {
  vendorId: number;
  storeName?: string;
  lineTotal: number;
  freeShipping: boolean;
}

export interface VendorShippingRow {
  vendorId: number;
  storeName?: string;
  itemsSubtotal: number;
  fee: number;
  free: boolean;
}

// Çekirdek: satıcı-bazlı kargoyu hem TOPLAM hem SATICI KIRILIMI olarak döner
// (kırılım müşteriye "hangi satıcıdan ne kadar kargo" gösterilsin diye).
export function computeVendorShipping(
  lines: VendorShippingLine[],
  baseFee: number,
  freeShippingThreshold: number,
): { total: number; breakdown: VendorShippingRow[] } {
  const byVendor = new Map<number, { storeName?: string; subtotal: number; allFree: boolean }>();
  for (const line of lines) {
    const g = byVendor.get(line.vendorId) ?? { storeName: line.storeName, subtotal: 0, allFree: true };
    g.subtotal += line.lineTotal;
    g.allFree = g.allFree && line.freeShipping === true;
    if (line.storeName && !g.storeName) g.storeName = line.storeName;
    byVendor.set(line.vendorId, g);
  }
  const breakdown: VendorShippingRow[] = [];
  let total = 0;
  for (const [vendorId, g] of byVendor) {
    const free = g.allFree || g.subtotal >= freeShippingThreshold;
    const fee = free ? 0 : baseFee;
    total += fee;
    breakdown.push({ vendorId, storeName: g.storeName, itemsSubtotal: g.subtotal, fee, free });
  }
  return { total, breakdown };
}

// Yalnızca toplamı isteyen çağıranlar (checkout) için ince sarmalayıcı - tek
// kaynaklı hesap, cart/checkout arasında drift olmasın diye.
export function computeMultiVendorShipping(
  lines: VendorShippingLine[],
  baseFee: number,
  freeShippingThreshold: number,
): number {
  return computeVendorShipping(lines, baseFee, freeShippingThreshold).total;
}
