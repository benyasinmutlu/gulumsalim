import { normalizeExternalHttpUrl, normalizePublicLink } from "./public-url";

const protectedSettingPatterns: Record<string, RegExp> = {
  color_primary: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  color_primary_dark: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  color_secondary: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  color_accent: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  hero_height_desktop: /^\d+(?:\.\d+)?(?:px|rem|vh|vw)$/,
  hero_height_mobile: /^\d+(?:\.\d+)?(?:px|rem|vh|vw)$/,
  hero_interval_ms: /^\d{3,6}$/,
  ga_measurement_id: /^G-[A-Z0-9]{4,20}$/,
  gtm_container_id: /^GTM-[A-Z0-9]{4,20}$/,
  meta_pixel_id: /^\d{5,32}$/,
  // Sepet toplamını etkileyen parasal ayarlar negatif, bilimsel gösterim
  // veya ikiden fazla ondalık kabul etmez. Eski bozuk kayıtlar okuma
  // katmanında yine güvenli varsayılana düşer (lib/shipping.ts).
  shipping_cost: /^(?:0|[1-9]\d{0,6})(?:[.,]\d{1,2})?$/,
  free_shipping_limit: /^(?:0|[1-9]\d{0,6})(?:[.,]\d{1,2})?$/,
};

const protectedSettingValidators: Record<string, (value: string) => boolean> = {
  site_instagram: (value) => normalizeExternalHttpUrl(value) !== null,
  site_facebook: (value) => normalizeExternalHttpUrl(value) !== null,
  site_logo: (value) => normalizePublicLink(value) !== null,
};

export function isKnownPublicSettingSafe(key: string, value: string) {
  if (value === "") return true;
  const validator = protectedSettingValidators[key];
  if (validator) return validator(value);
  const pattern = protectedSettingPatterns[key];
  return pattern ? pattern.test(value) : true;
}

export function filterUnsafePublicSettings(settings: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(settings).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && isKnownPublicSettingSafe(entry[0], entry[1]),
    ),
  );
}
