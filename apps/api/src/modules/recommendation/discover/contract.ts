import { createHash } from "node:crypto";

// =============================================================================
// Personalized Discover v1 — Response & Tracking Contract (FAZ 1/5)
// =============================================================================
// X/the-algorithm'ın Home Mixer kavramının e-ticaret uyarlaması: çok kaynaklı
// aday üretimi → feature hydration → skorlama → çeşitlilik → bölüm karıştırma.
// (bkz. docs/architecture/x-algorithm-adaptation-notes.md)

export const ALGORITHM_VERSION = "discover-v1" as const;

export type DiscoverSurface = "home" | "discover" | "pdp";

export type CandidateSourceName =
  | "personal_history"
  | "collaborative"
  | "trending"
  | "exploration"
  | "popular_fallback";

export type ReasonCode =
  | "because_you_viewed"
  | "similar_to_favorites"
  | "similar_to_cart"
  | "people_also_viewed"
  | "trending_now"
  | "new_arrival"
  | "discover_new_brand"
  | "popular";

export type SectionKey = "for_you" | "trending" | "discover_new";

export interface Candidate {
  productId: number;
  vendorId: number;
  source: CandidateSourceName;
  rawScore: number; // kaynak-yerel skor (0..1)
  reason: ReasonCode;
  version: string; // kaynak kural/model sürümü
  generatedAt: number;
}

export interface DiscoverItem {
  productId: number;
  recommendationId: string; // (request, product) başına — tıklama takibi
  reasonCode: ReasonCode;
  score: number;
  source: CandidateSourceName;
}

export interface DiscoverSection {
  key: SectionKey;
  title: string;
  items: DiscoverItem[];
}

export interface DiscoverResponse {
  requestId: string;
  algorithmVersion: string;
  sections: DiscoverSection[];
  cursor: string | null;
  fallbackUsed: boolean;
  // Kişiselleştirilmiş yanıt kullanıcılar arası CACHE'LENMEMELİ (leak riski).
  // Web/CDN bu bayrağa göre private/no-store uygular (bkz. FAZ 5 web notları).
  cacheable: boolean;
}

export interface DiscoverRequest {
  customerId?: number; // yalnız authenticated session'dan; body'den DEĞİL
  sessionId: string;
  surface: DiscoverSurface;
  limit: number;
  cursor?: string | null;
  consent: { personalization: boolean; analytics: boolean };
}

// --- Cursor: offset tabanlı, sürüme bağlı, kararlı kodlama --------------------
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset, v: ALGORITHM_VERSION })).toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: number; v?: string };
    if (parsed.v !== ALGORITHM_VERSION || typeof parsed.o !== "number" || parsed.o < 0) return 0;
    return Math.floor(parsed.o);
  } catch {
    return 0; // bozuk cursor → baştan başla (fail-safe, stabil)
  }
}

// recommendationId: (requestId, productId) için deterministik — tıklama event'i
// bunu taşır, böylece hangi öneri tıklandı izlenebilir.
export function recommendationId(requestId: string, productId: number): string {
  return createHash("sha256").update(`${requestId}|${productId}`).digest("hex").slice(0, 20);
}

// Deneme (A/B) için deterministik, kararlı bucketing: aynı stableId → aynı
// bucket. control=legacy, treatment=personalized-v1 (bkz. experiment plan).
export function experimentBucket(experimentId: string, stableId: string, buckets = 100): number {
  const h = createHash("sha256").update(`${experimentId}|${stableId}`).digest();
  return h.readUInt32BE(0) % buckets;
}
