import { experimentBucket } from "./contract";

// =============================================================================
// Discover v1 rollout eligibility (FAZ 5) — global kill switch + müşteri
// allowlist + deterministic yüzdelik rollout + ayrı anonymous flag.
// Gerçek kullanıcıya açmadan önce yalnız test hesabı allowlist'iyle doğrulanır.
// =============================================================================

export interface DiscoverFlags {
  enabled: boolean; // DISCOVER_V1_ENABLED — global kill switch
  rolloutPercent: number; // 0..100 — authenticated deterministic rollout
  customerAllowlist: ReadonlySet<number>;
  anonymousEnabled: boolean; // anonim rollout ayrı karar
}

// Env'den güvenli/bounded parse. Allowlist yalnız pozitif tam sayı ID'ler.
export function parseDiscoverFlags(env: Record<string, string | undefined>): DiscoverFlags {
  const ids = (env.DISCOVER_V1_CUSTOMER_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 1000) // bounded
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
  const pctRaw = Number(env.DISCOVER_V1_ROLLOUT_PERCENT ?? 0);
  const rolloutPercent = Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : 0;
  return {
    enabled: env.DISCOVER_V1_ENABLED === "true",
    rolloutPercent,
    customerAllowlist: new Set(ids),
    anonymousEnabled: env.DISCOVER_V1_ANONYMOUS_ENABLED === "true",
  };
}

// Karar sırası: global kapalı → legacy. Allowlist'teyse → v1. Anonim ve anon
// kapalıysa → legacy. Aksi halde yüzdelik kovaya göre (stabil: aynı kullanıcı
// yüzde değişmedikçe aynı sonucu görür). Bkz. experimentBucket.
export function isEligibleForDiscoverV1(
  identity: { customerId?: number; stableId: string },
  flags: DiscoverFlags,
): boolean {
  if (!flags.enabled) return false;
  if (identity.customerId != null && flags.customerAllowlist.has(identity.customerId)) return true;
  if (identity.customerId == null && !flags.anonymousEnabled) return false;
  if (flags.rolloutPercent <= 0) return false;
  if (flags.rolloutPercent >= 100) return true;
  return experimentBucket("discover-v1-rollout", identity.stableId, 100) < flags.rolloutPercent;
}
