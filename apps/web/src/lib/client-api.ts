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
  ) {
    super(message);
  }
}

// POST/PATCH/DELETE gibi durum değiştiren her istek önce bir CSRF token
// alır, sonra header'da geri gönderir (bkz. apps/api/src/plugins/csrf.ts).
export async function mutateJson<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const csrfToken = await getCsrfToken();
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ClientApiError(res.status, errBody?.error?.message ?? "İstek başarısız oldu");
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
    throw new ClientApiError(res.status, errBody?.error?.message ?? "Yükleme başarısız oldu");
  }

  return res.json() as Promise<T>;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ClientApiError(res.status, errBody?.error?.message ?? "İstek başarısız oldu");
  }
  return res.json() as Promise<T>;
}
