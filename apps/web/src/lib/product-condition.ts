import type { ProductCondition } from "./types";

// bkz. denetim raporu madde 1: "Ürün kondisyonu zorunlu olmalı" - satıcı
// panelindeki (yeni ürün formu + düzenleme formu) ve ürün detay sayfasındaki
// gösterimin AYNI 5 seçenek/etiket setini kullanması için tek kaynak.
export const PRODUCT_CONDITIONS: { value: ProductCondition; label: string }[] = [
  { value: "new_with_tags", label: "Yeni / Etiketli" },
  { value: "new_without_tags", label: "Yeni / Etiketsiz" },
  { value: "very_good", label: "Çok İyi Durumda" },
  { value: "good", label: "İyi Durumda" },
  { value: "used", label: "Kullanılmış" },
];

export const CONDITION_LABELS: Record<ProductCondition, string> = Object.fromEntries(
  PRODUCT_CONDITIONS.map((c) => [c.value, c.label]),
) as Record<ProductCondition, string>;

// "Yeni / Etiketli" veya "Yeni / Etiketsiz" dışındaki her kondisyon 2. el
// sayılır - new-product-form.tsx'teki isSecondHand bayrağı bundan türetilir.
export function isSecondHandCondition(condition: ProductCondition): boolean {
  return condition !== "new_with_tags" && condition !== "new_without_tags";
}
