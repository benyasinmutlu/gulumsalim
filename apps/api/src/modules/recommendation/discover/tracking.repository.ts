import { gt, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { discoverEvents } from "../../../db/schema/index";
import type { TrustedEvent } from "./event-security";

// =============================================================================
// Keşif etkileşim persist (FAZ C/D). validateEventBatch'ten geçmiş GÜVENİLİR
// event'leri yazar. dedup_key ile idempotent (aynı event tekrar yazılmaz).
// A/B ölçümü (CTR: click/impression) + geri besleme buradan okunur.
// =============================================================================

export interface DiscoverEventRow {
  type: string;
  customerId: number | null;
  sessionId: string;
  productId: number | null;
  vendorId: number | null;
  categoryId: number | null;
  source: string;
  occurredAt: Date;
  dedupKey: string;
}

// SAF: TrustedEvent → DB satırı (test edilebilir sınır).
export function toDiscoverEventRow(e: TrustedEvent): DiscoverEventRow {
  return {
    type: e.type,
    customerId: e.customerId ?? null,
    sessionId: e.sessionId,
    productId: e.productId ?? null,
    vendorId: e.vendorId ?? null,
    categoryId: e.categoryId ?? null,
    source: e.source,
    occurredAt: new Date(e.occurredAt),
    dedupKey: e.dedupKey,
  };
}

export async function recordTrustedEvents(events: TrustedEvent[]): Promise<void> {
  if (events.length === 0) return;
  await db.insert(discoverEvents).values(events.map(toDiscoverEventRow)).onConflictDoNothing();
}

// ---------- CTR (tıklama oranı) — A/B değerlendirme ----------

export interface CtrRow {
  source: string;
  impressions: number;
  clicks: number;
}
export interface CtrStat extends CtrRow {
  ctr: number; // 0..1 (impression 0 ise 0)
}
export interface CtrReport {
  bySource: CtrStat[];
  overall: CtrStat;
}

// SAF: ham (source, impressions, clicks) satırlarından CTR raporu. Test edilebilir.
export function computeCtr(rows: CtrRow[]): CtrReport {
  const bySource: CtrStat[] = rows
    .map((r) => ({ ...r, ctr: r.impressions > 0 ? r.clicks / r.impressions : 0 }))
    .sort((a, b) => b.impressions - a.impressions);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  return { bySource, overall: { source: "ALL", impressions, clicks, ctr: impressions > 0 ? clicks / impressions : 0 } };
}

// Son penceredeki kaynak-başına gösterim/tıklama → CTR raporu.
export async function getDiscoverCtr(sinceMs: number): Promise<CtrReport> {
  const rows = await db
    .select({
      source: discoverEvents.source,
      impressions: sql<number>`count(*) filter (where ${discoverEvents.type} = 'impression')`,
      clicks: sql<number>`count(*) filter (where ${discoverEvents.type} = 'click')`,
    })
    .from(discoverEvents)
    .where(gt(discoverEvents.occurredAt, new Date(sinceMs)))
    .groupBy(discoverEvents.source);
  return computeCtr(rows.map((r) => ({ source: r.source, impressions: Number(r.impressions), clicks: Number(r.clicks) })));
}
