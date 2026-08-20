import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { reconcilePendingOrders } from "./order-reconciliation.service";

const LOCK_KEY = "reconcile:pending-orders:lock";
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

interface SchedulerOptions {
  intervalMs?: number;
  staleMs?: number;
  lockTtlSec?: number;
  kickoffMs?: number;
}

export function startOrderReconciliationJob(app: FastifyInstance, options: SchedulerOptions = {}) {
  const { intervalMs = 5 * 60 * 1000, staleMs = 15 * 60 * 1000, lockTtlSec = 240, kickoffMs = 30_000 } = options;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    const lockToken = randomUUID();
    let acquired = false;
    try {
      acquired = (await app.redis.set(LOCK_KEY, lockToken, "EX", lockTtlSec, "NX")) === "OK";
      if (!acquired) return;
      await reconcilePendingOrders(app, { staleMs });
    } catch (error) {
      app.log.warn({ error }, "Ödeme mutabakatı zamanlayıcı hatası");
    } finally {
      if (acquired) {
        await app.redis.eval(RELEASE_LOCK_SCRIPT, 1, LOCK_KEY, lockToken).catch(() => undefined);
      }
      running = false;
    }
  };

  const interval = setInterval(tick, intervalMs);
  interval.unref?.();
  const kickoff = setTimeout(tick, kickoffMs);
  kickoff.unref?.();

  return {
    stop() {
      clearInterval(interval);
      clearTimeout(kickoff);
    },
  };
}
