import { apiFetchJson } from "./api";

// =============================================================================
// Personalized Discover v1 — typed web client (FAZ 6)
// =============================================================================
// Mevcut apiFetchJson desenini kullanır (server component; oturum çerezini taşır).
// Yeni Next.js deseni EKLEMEZ — sadece typed contract + güvenli fallback.

export type DiscoverSectionKey = "for_you" | "trending" | "discover_new";

export interface DiscoverItem {
  productId: number;
  recommendationId: string;
  reasonCode: string;
  score: number;
  source: string;
}

export interface DiscoverSection {
  key: DiscoverSectionKey;
  title: string;
  items: DiscoverItem[];
}

export interface DiscoverResponse {
  requestId: string;
  algorithmVersion: string;
  sections: DiscoverSection[];
  cursor: string | null;
  fallbackUsed: boolean;
  cacheable: boolean;
  experimentId?: string;
  treatment?: string;
}

const EMPTY: DiscoverResponse = {
  requestId: "unavailable",
  algorithmVersion: "unavailable",
  sections: [],
  cursor: null,
  fallbackUsed: true,
  cacheable: false,
};

export interface FetchDiscoverParams {
  limit?: number;
  cursor?: string;
  surface?: "home" | "discover" | "pdp";
}

// Keşfet akışını çeker. API erişilemezse ana sayfa ÇÖKMEZ — boş yanıta düşer
// (mevcut /discover route'undaki graceful davranışla tutarlı).
export async function fetchDiscoverV1(params: FetchDiscoverParams = {}): Promise<DiscoverResponse> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.surface) qs.set("surface", params.surface);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  try {
    return await apiFetchJson<DiscoverResponse>(`/v1/discover${suffix}`);
  } catch {
    return EMPTY;
  }
}
