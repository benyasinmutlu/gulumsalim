import type { FastifyBaseLogger } from "fastify";
import { env } from "../../config/env";
import { pollPttTrackingBatch } from "./ptt-shipment.service";

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startPttTrackingScheduler(log: FastifyBaseLogger) {
  if (timer || !env.PTT_CUSTOMER_ID || !env.PTT_PASSWORD) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const result = await pollPttTrackingBatch();
      if (result.failed > 0) log.warn(result, "PTT takip turunda bazı gönderiler sorgulanamadı");
    } catch (error) {
      log.warn({ err: error }, "PTT takip turu tamamlanamadı");
    } finally {
      running = false;
    }
  }, env.PTT_TRACKING_POLL_INTERVAL_MS);
  timer.unref();
}

export function stopPttTrackingScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
