import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env";
import { claimDueFeedSources } from "./merchant-feed.repository";
import { syncClaimedFeedSource } from "./merchant-feed.service";

let timer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let running = false;

export async function runMerchantFeedSchedulerTick(log: FastifyBaseLogger): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    const sources = await claimDueFeedSources(env.MERCHANT_FEED_BATCH_SIZE);
    await Promise.all(sources.map((source) => syncClaimedFeedSource(source).catch((error) => {
      log.warn({ sourceId: source.id, error: error instanceof Error ? error.message : "feed error" }, "merchant feed senkronu başarısız");
    })));
  } catch (error) {
    log.error({ error }, "merchant feed scheduler çalışamadı");
  } finally {
    running = false;
  }
  return true;
}

export function startMerchantFeedScheduler(log: FastifyBaseLogger) {
  if (timer) return;
  timer = setInterval(() => void runMerchantFeedSchedulerTick(log), env.MERCHANT_FEED_POLL_INTERVAL_MS);
  timer.unref();
  startupTimer = setTimeout(() => {
    startupTimer = null;
    void runMerchantFeedSchedulerTick(log);
  }, Math.min(5_000, env.MERCHANT_FEED_POLL_INTERVAL_MS));
  startupTimer.unref();
}

export function stopMerchantFeedScheduler() {
  if (timer) clearInterval(timer);
  if (startupTimer) clearTimeout(startupTimer);
  timer = null;
  startupTimer = null;
}
