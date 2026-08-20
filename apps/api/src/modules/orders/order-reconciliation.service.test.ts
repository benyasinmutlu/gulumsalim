import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { reconcilePendingOrders, type ReconcileDeps } from "./order-reconciliation.service";

const app = {
  log: { warn: vi.fn(), info: vi.fn() },
} as unknown as FastifyInstance;

const order = (id: number, paymentRef: string | null) => ({ id, orderNumber: `GS-${id}`, paymentRef, createdAt: new Date() });
const deps = (overrides: Partial<ReconcileDeps> = {}): ReconcileDeps => ({
  findStale: async () => [],
  handleCallback: async () => null,
  markFailed: async () => true,
  ...overrides,
});

describe("reconcilePendingOrders", () => {
  it("closes an abandoned order with no provider token", async () => {
    const markFailed = vi.fn(async () => true);
    const result = await reconcilePendingOrders(app, {}, deps({ findStale: async () => [order(1, null)], markFailed }));
    expect(markFailed).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ checked: 1, closedOrUnresolved: 1, errors: 0 });
  });

  it("recovers a successful lost callback", async () => {
    const result = await reconcilePendingOrders(app, {}, deps({
      findStale: async () => [order(2, "token")],
      handleCallback: async () => ({ orderNumber: "GS-2", success: true }),
    }));
    expect(result).toMatchObject({ recovered: 1, closedOrUnresolved: 0 });
  });

  it("isolates a transient provider error and continues", async () => {
    const handleCallback = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ orderNumber: "GS-4", success: true });
    const result = await reconcilePendingOrders(app, {}, deps({
      findStale: async () => [order(3, "a"), order(4, "b")],
      handleCallback,
    }));
    expect(result).toMatchObject({ checked: 2, recovered: 1, errors: 1 });
  });

  it("passes configured age and batch limit to the repository", async () => {
    const findStale = vi.fn(async () => []);
    await reconcilePendingOrders(app, { staleMs: 1234, limit: 7 }, deps({ findStale }));
    expect(findStale).toHaveBeenCalledWith(1234, 7);
  });
});
