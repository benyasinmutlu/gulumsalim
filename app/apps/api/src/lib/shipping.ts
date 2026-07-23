import { getPublicSettings } from "../modules/content/content.repository";

export const DEFAULT_SHIPPING_FEE = 49.9;
export const DEFAULT_FREE_SHIPPING_THRESHOLD = 500;

// gulumsalim.com'daki admin/settings.php > Kargo sekmesinin karşılığı -
// admin panelden değiştirilebilir, hiç ayarlanmamışsa eski sabit
// değerlere düşer. Hem sepet (cart.service.ts) hem checkout
// (checkout.service.ts) AYNI hesaplamayı kullanır - daha önce checkout
// gerçek ücreti biliyordu ama sepet/ödeme sayfaları müşteriye hiç
// göstermiyordu (bkz. kullanıcı isteği: "kargo ücreti ne ise o yazsın").
export async function getShippingConfig() {
  const rows = await getPublicSettings(["shipping_cost", "free_shipping_limit"]);
  const shippingFee = rows.shipping_cost ? Number(rows.shipping_cost) : DEFAULT_SHIPPING_FEE;
  const freeShippingThreshold = rows.free_shipping_limit ? Number(rows.free_shipping_limit) : DEFAULT_FREE_SHIPPING_THRESHOLD;
  return { shippingFee, freeShippingThreshold };
}
