export function applyFeedStockDelta(
  currentLocalStock: number,
  previousSourceStock: number,
  nextSourceStock: number,
  wasActive: boolean,
): number {
  const current = Math.max(0, Math.floor(currentLocalStock));
  const previous = Math.max(0, Math.floor(previousSourceStock));
  const next = Math.max(0, Math.floor(nextSourceStock));
  return wasActive ? Math.max(0, current + (next - previous)) : next;
}

export function nextFeedRunAt(nowMs: number, intervalMinutes: number, random = Math.random): Date {
  const intervalMs = Math.max(15, Math.min(1440, Math.floor(intervalMinutes))) * 60_000;
  const jitterMs = Math.floor(intervalMs * (Math.max(0, Math.min(1, random())) * 0.2 - 0.1));
  return new Date(nowMs + intervalMs + jitterMs);
}

export type FeedFailureAlertLevel = "warning" | "critical";

export function feedFailureAlertLevel(
  previousFailures: number,
  permanent: boolean,
  zeroedStockCount: number,
): FeedFailureAlertLevel | null {
  if (permanent || zeroedStockCount > 0) return "critical";
  const nextFailure = previousFailures + 1;
  return nextFailure === 1 || nextFailure === 3 ? "warning" : null;
}
