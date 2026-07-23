import { cookies } from "next/headers";
import { API_URL } from "./env";

// Sadece Server Component'lerden çağrılır. Next.js'in server'ı API'ye
// doğrudan (nginx'i atlayarak) 127.0.0.1 üzerinden bağlanır - ama gelen
// isteğin oturum çerezini elle taşımazsak API tarafı kullanıcıyı "misafir"
// sanır (server-to-server fetch, tarayıcının çerezini otomatik taşımaz).
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      cookie: cookieHeader,
    },
    cache: "no-store",
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? "API isteği başarısız oldu");
  }
  return res.json() as Promise<T>;
}

// apiFetch'in aksine cookies() OKUMAZ - kimlik doğrulaması gerektirmeyen,
// tamamen herkese açık uçlar için (ör. site-settings). Root layout gibi
// TÜM sayfaları saran yerlerde apiFetch kullanmak, cookies() çağrısı
// yüzünden bütün siteyi statik render'dan dinamiğe düşürüyordu - bu,
// çerezden bağımsız olduğu için o sorunu yaşamıyor.
export async function publicFetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? "API isteği başarısız oldu");
  }
  return res.json() as Promise<T>;
}
