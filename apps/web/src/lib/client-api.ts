"use client";

import type { ApiErrorBody } from "./types";

// Tarayıcıdan çağrılır. "/api/..." relative path kullanılır - prod'da
// nginx, dev'de next.config.ts'deki rewrite bunu Fastify'a yönlendirir
// (bkz. lib/api.ts'deki server-side apiFetch'in aksine, burada çerez elle
// taşınmaz çünkü tarayıcı zaten aynı origin'e otomatik gönderir).
async function getCsrfToken(): Promise<string> {
  const res = await fetch("/api/auth/csrf-token", { credentials: "include" });
  const data = (await res.json()) as { csrfToken: string };
  return data.csrfToken;
}

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

// error-handler.ts'deki Zod doğrulama hataları hep aynı jenerik "Geçersiz
// istek" mesajıyla döner, asıl sebep (ör. "IBAN içeremez") details.fieldErrors
// içinde saklı kalır. Formlarda kullanıcıya anlamlı bir mesaj göstermek için
// varsa ilk alan hatasını, yoksa jenerik mesajı kullanıyoruz.
function messageFromErrorBody(errBody: ApiErrorBody | null, fallback: string): string {
  const fieldErrors = (errBody?.error?.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
  const firstFieldError = fieldErrors && Object.values(fieldErrors).flat().find((m) => typeof m === "string" && m.length > 0);
  return firstFieldError ?? errBody?.error?.message ?? fallback;
}

// POST/PATCH/DELETE gibi durum değiştiren her istek önce bir CSRF token
// alır, sonra header'da geri gönderir (bkz. apps/api/src/plugins/csrf.ts).
export async function mutateJson<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: {
      // Content-Type sadece gerçekten bir gövde varsa gönderilir - Fastify'ın
      // varsayılan JSON body parser'ı, content-type application/json ama
      // gövde boşken "Body cannot be empty when content-type is set to
      // 'application/json'" hatasıyla 400 döndürüyor. Bu, gövdesiz her
      // POST/DELETE çağrısını (banner onayla, mağaza takip et, sayısız
      // "sil" butonu) sessizce kırıyordu - handler hiç çalışmadan istek
      // reddediliyordu.
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "x-csrf-token": csrfToken,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ClientApiError(res.status, messageFromErrorBody(errBody, "İstek başarısız oldu"), errBody?.error?.code);
  }

  return res.json() as Promise<T>;
}

// Görsel yükleme gibi multipart istekler için - Content-Type elle
// ayarlanmaz, tarayıcı FormData'dan doğru boundary'li Content-Type'ı
// kendisi üretir.
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const csrfToken = await getCsrfToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "x-csrf-token": csrfToken },
    body: formData,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ClientApiError(res.status, messageFromErrorBody(errBody, "Yükleme başarısız oldu"), errBody?.error?.code);
  }

  return res.json() as Promise<T>;
}

// admin/promo-banners.php'deki tıklama takibinin karşılığı - kimlik/CSRF
// gerekmez (misafir de tıklayabilir), navigasyonu bloklamaması için sonucu
// beklenmez.
export function trackPromoBannerClick(bannerId: number) {
  fetch(`/api/promo-banners/${bannerId}/click`, { method: "POST", keepalive: true }).catch(() => {});
}

// bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı" - bkz.
// components/promo-banner-impression.tsx.
export function trackPromoBannerView(bannerId: number) {
  fetch(`/api/promo-banners/${bannerId}/view`, { method: "POST", keepalive: true }).catch(() => {});
}

// bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
// görebilmeliyim" - trackPromoBannerClick/View ile aynı desen: kimlik/CSRF
// gerekmez, navigasyonu bloklamaz (bkz. components/presence-heartbeat.tsx).
export function pingPresence(path: string) {
  fetch("/api/presence/ping", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).catch(() => {});
}

// Sayfa kapanırken/sekme değişirken güvenilir teslimat için sendBeacon
// kullanılır (bkz. components/dwell-tracker.tsx) - fetch keepalive bu anda
// tarayıcı tarafından iptal edilebiliyor, sendBeacon özellikle bunun için var.
export function reportDwell(productId: number, ms: number) {
  const blob = new Blob([JSON.stringify({ productId, ms })], { type: "application/json" });
  navigator.sendBeacon?.("/api/analytics/dwell", blob);
}

// bkz. kullanıcı isteği: "kategoriler sayfalar koleksiyonlar mağazalar
// kampanyalar ... çok önemli bunlar" - anasayfa bölümü görüntülenmesi/kalma
// süresi için genel izleme ucu (bkz. components/section-analytics-tracker.tsx).
// "view" anlık/hafif olduğu için fetch+keepalive yeterli; "dwell" sayfadan
// ayrılırken gönderildiği için reportDwell ile aynı sendBeacon gerekçesi geçerli.
export function trackContentView(contentType: "category" | "homepage_section", contentId: number) {
  fetch("/api/analytics/track", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, contentId, eventType: "view" }),
  }).catch(() => {});
}

export function trackContentDwell(contentType: "category" | "homepage_section", contentId: number, ms: number) {
  const blob = new Blob([JSON.stringify({ contentType, contentId, eventType: "dwell", value: ms })], { type: "application/json" });
  navigator.sendBeacon?.("/api/analytics/track", blob);
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ClientApiError(res.status, messageFromErrorBody(errBody, "İstek başarısız oldu"), errBody?.error?.code);
  }
  return res.json() as Promise<T>;
}
