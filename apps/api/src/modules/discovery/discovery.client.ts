import { env } from "../../config/env";

export interface DiscoverResult {
  productIds: number[];
  strategy: "personalized" | "cold_start";
}

// Go keşfet servisi sadece 127.0.0.1'de dinliyor ve paylaşımlı bir gizli
// anahtar bekliyor - dışarıdan asla doğrudan çağrılamaz, sadece bu
// fonksiyon üzerinden.
export async function fetchDiscoverFeed(customerId: number | undefined, limit = 12): Promise<DiscoverResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (customerId) params.set("userId", String(customerId));

  const res = await fetch(`${env.DISCOVERY_SERVICE_URL}/discover?${params.toString()}`, {
    headers: { "X-Internal-Secret": env.DISCOVERY_SERVICE_SECRET },
  });
  if (!res.ok) throw new Error("Keşfet servisi yanıt vermedi");
  return res.json() as Promise<DiscoverResult>;
}
