import type { FastifyInstance } from "fastify";
import { handlePaymentCallback } from "./checkout.service";
import { findStalePendingOrderRefs } from "./order.repository";

// Müşteri iyzico ödeme sayfasını hiç tamamlamadan terk ederse callback asla
// gelmez (bkz. order.repository.ts findStalePendingOrderRefs) ve sipariş
// oluşturma anında düşürülen stok sonsuza dek "kilitli" kalır. Bu job
// periyodik olarak yeterince eski pending siparişlerin GERÇEK durumunu
// iyzico'dan sorar - handlePaymentCallback ile AYNI doğrulama/idempotentlik
// yolunu kullanır, kör bir zaman aşımıyla stok iade etmez; kaçırılmış
// gerçek bir "success" callback'ini de kurtarmış olur.
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 dk
const STALE_THRESHOLD_MINUTES = 30;

let timer: NodeJS.Timeout | null = null;
let running = false;

async function checkOnce(app: FastifyInstance): Promise<void> {
  if (running) return;
  running = true;
  try {
    const refs = await findStalePendingOrderRefs(STALE_THRESHOLD_MINUTES);
    for (const ref of refs) {
      await handlePaymentCallback(app, ref).catch((err) => app.log.warn({ err, ref }, "Askıdaki sipariş mutabakatı başarısız oldu"));
    }
  } finally {
    running = false;
  }
}

export function startExpireStaleOrdersJob(app: FastifyInstance): void {
  if (!timer) {
    timer = setInterval(() => void checkOnce(app), CHECK_INTERVAL_MS);
    timer.unref?.();
  }
}

export function stopExpireStaleOrdersJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
