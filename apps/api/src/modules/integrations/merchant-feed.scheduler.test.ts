import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";

const mocks = vi.hoisted(() => ({
  claimDueFeedSources: vi.fn(),
  syncClaimedFeedSource: vi.fn(),
}));

vi.mock("./merchant-feed.repository", () => ({ claimDueFeedSources: mocks.claimDueFeedSources }));
vi.mock("./merchant-feed.service", () => ({ syncClaimedFeedSource: mocks.syncClaimedFeedSource }));

import {
  runMerchantFeedSchedulerTick,
  startMerchantFeedScheduler,
  stopMerchantFeedScheduler,
} from "./merchant-feed.scheduler";

const log = {
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as FastifyBaseLogger;

afterEach(() => {
  stopMerchantFeedScheduler();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("merchant feed scheduler worker", () => {
  it("claims the bounded configured batch and isolates per-source failures", async () => {
    mocks.claimDueFeedSources.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    mocks.syncClaimedFeedSource
      .mockResolvedValueOnce({ status: "success" })
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValue({ status: "unchanged" });

    await expect(runMerchantFeedSchedulerTick(log)).resolves.toBe(true);

    expect(mocks.claimDueFeedSources).toHaveBeenCalledWith(4);
    expect(mocks.syncClaimedFeedSource).toHaveBeenCalledTimes(4);
    expect(log.warn).toHaveBeenCalledWith(
      { sourceId: 2, error: "provider unavailable" },
      "merchant feed senkronu başarısız",
    );
  });

  it("does not overlap ticks within one API instance", async () => {
    let release!: () => void;
    mocks.claimDueFeedSources.mockResolvedValue([{ id: 10 }]);
    mocks.syncClaimedFeedSource.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));

    const first = runMerchantFeedSchedulerTick(log);
    await vi.waitFor(() => expect(mocks.syncClaimedFeedSource).toHaveBeenCalledOnce());
    await expect(runMerchantFeedSchedulerTick(log)).resolves.toBe(false);
    release();
    await expect(first).resolves.toBe(true);
  });

  it("cancels both startup and recurring timers during shutdown", async () => {
    vi.useFakeTimers();
    startMerchantFeedScheduler(log);
    stopMerchantFeedScheduler();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.claimDueFeedSources).not.toHaveBeenCalled();
  });
});
