import { describe, expect, it } from "vitest";
import { isRetryableTransactionError, sortStockReservations, withTransactionRetry } from "./order-concurrency";

describe("order concurrency guards", () => {
  it("locks variant and product stock rows in one deterministic order", () => {
    const items = [
      { productId: 8 },
      { productId: 3, variantId: 12 },
      { productId: 2 },
      { productId: 7, variantId: 4 },
    ];

    expect(sortStockReservations(items)).toEqual([
      { productId: 7, variantId: 4 },
      { productId: 3, variantId: 12 },
      { productId: 2 },
      { productId: 8 },
    ]);
    expect(items[0]).toEqual({ productId: 8 });
  });

  it("retries only PostgreSQL deadlock and serialization failures", () => {
    expect(isRetryableTransactionError({ code: "40P01" })).toBe(true);
    expect(isRetryableTransactionError({ cause: { code: "40001" } })).toBe(true);
    expect(isRetryableTransactionError({ code: "23505" })).toBe(false);
    expect(isRetryableTransactionError(new Error("network"))).toBe(false);
  });

  it("re-runs the whole operation after a deadlock and eventually succeeds", async () => {
    let calls = 0;
    const waits: number[] = [];

    const result = await withTransactionRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw { code: "40P01" };
        return "committed";
      },
      { wait: async (attempt) => void waits.push(attempt) },
    );

    expect(result).toBe("committed");
    expect(calls).toBe(3);
    expect(waits).toEqual([1, 2]);
  });

  it("does not retry a business or constraint error", async () => {
    let calls = 0;
    const failure = { code: "23505" };

    await expect(
      withTransactionRetry(async () => {
        calls += 1;
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(calls).toBe(1);
  });
});
