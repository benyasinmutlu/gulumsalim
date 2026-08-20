import type { FastifyInstance } from "fastify";
import { findStalePendingOrders, markOrderPaymentFailed } from "./order.repository";
import { handlePaymentCallback } from "./checkout.service";

interface StaleOrder {
  id: number;
  orderNumber: string;
  paymentRef: string | null;
  createdAt: Date;
}

export interface ReconcileDeps {
  findStale: (olderThanMs: number, limit?: number) => Promise<StaleOrder[]>;
  handleCallback: (app: FastifyInstance, token: string) => Promise<{ orderNumber: string; success: boolean } | null>;
  markFailed: (orderId: number) => Promise<unknown>;
}

export interface ReconcileResult {
  checked: number;
  recovered: number;
  closedOrUnresolved: number;
  errors: number;
}

const defaultDeps: ReconcileDeps = {
  findStale: findStalePendingOrders,
  handleCallback: handlePaymentCallback,
  markFailed: markOrderPaymentFailed,
};

export async function reconcilePendingOrders(
  app: FastifyInstance,
  { staleMs = 15 * 60 * 1000, limit = 100 }: { staleMs?: number; limit?: number } = {},
  deps: ReconcileDeps = defaultDeps,
): Promise<ReconcileResult> {
  const stale = await deps.findStale(staleMs, limit);
  const result: ReconcileResult = { checked: stale.length, recovered: 0, closedOrUnresolved: 0, errors: 0 };

  for (const order of stale) {
    try {
      if (!order.paymentRef) {
        await deps.markFailed(order.id);
        result.closedOrUnresolved++;
        continue;
      }
      const outcome = await deps.handleCallback(app, order.paymentRef);
      if (outcome?.success) result.recovered++;
      else result.closedOrUnresolved++;
    } catch (error) {
      result.errors++;
      app.log.warn({ error, orderId: order.id }, "Ödeme mutabakatında sipariş işlenemedi; yeniden denenecek");
    }
  }

  if (result.checked > 0) app.log.info(result, "Ödeme mutabakatı tamamlandı");
  return result;
}
