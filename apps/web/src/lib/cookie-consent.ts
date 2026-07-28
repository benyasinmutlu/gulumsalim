// Çerez Politikası'ndaki 4 kategori (Zorunlu/Performans/İşlevsellik/Reklam)
// için ziyaretçi tercihini localStorage'da tutar. Şu an sitede gerçek bir
// analytics/reklam scripti (GA, Meta Pixel vb.) yok - bu yüzden hiçbir şeyi
// GATE'lemiyor, sadece ileride bir script eklenirse "yükleyebilir miyim?"
// diye sorulacak tek referans nokta burası olsun diye hazırlandı.
export type CookieCategory = "performans" | "islevsellik" | "reklam";

export interface CookieConsent {
  zorunlu: true;
  performans: boolean;
  islevsellik: boolean;
  reklam: boolean;
  decidedAt: string;
}

const STORAGE_KEY = "gs_cookie_consent";

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

export function setCookieConsent(consent: Omit<CookieConsent, "zorunlu" | "decidedAt">): CookieConsent {
  const full: CookieConsent = { zorunlu: true, ...consent, decidedAt: new Date().toISOString() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));

  // localStorage sadece "bandoyu bir daha gösterme" içindir - KVKK/denetim
  // açısından kanıt sayılmaz, bu yüzden aynı tercih sunucuya da kaydedilir
  // (bkz. apps/api/src/modules/content/content.routes.ts POST /cookie-consent).
  // Ateşle-unut: kayıt başarısız olsa bile banner kullanıcıyı bloklamaz.
  fetch("/api/cookie-consent", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      performance: consent.performans,
      functionality: consent.islevsellik,
      advertising: consent.reklam,
    }),
  }).catch(() => {});

  return full;
}

export function hasConsentFor(category: CookieCategory): boolean {
  return getCookieConsent()?.[category] === true;
}
