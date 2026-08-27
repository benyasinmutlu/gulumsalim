import type { FastifyBaseLogger } from "fastify";
import { claimDueFeedSources } from "./merchant-feed.repository";
import { syncClaimedFeedSource } from "./merchant-feed.service";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(log: FastifyBaseLogger) {
  if (running) return;
  running = true;
  try {
    const sources = await claimDueFeedSources(2);
    await Promise.all(sources.map((source) => syncClaimedFeedSource(source).catch((error) => {
      log.warn({ sourceId: source.id, error: error instanceof Error ? error.message : "feed error" }, "merchant feed senkronu başarısız");
    })));
  } catch (error) {
    log.error({ error }, "merchant feed scheduler çalışamadı");
  } finally {
    running = false;
  }
}

export function startMerchantFeedScheduler(log: FastifyBaseLogger) {
  if (timer) return;
  timer = setInterval(() => void tick(log), 60_000);
  timer.unref();
  setTimeout(() => void tick(log), 5_000).unref();
}

export function stopMerchantFeedScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
