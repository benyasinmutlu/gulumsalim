import { afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  retrieve: vi.fn(),
  initialize: vi.fn(),
  refund: vi.fn(),
  refundV2: vi.fn(),
}));

vi.mock("iyzipay", () => ({
  default: class IyzipayMock {
    checkoutFormInitialize = { create: sdk.initialize };
    checkoutForm = { retrieve: sdk.retrieve };
    refund = { create: sdk.refund };
    refundV2 = { create: sdk.refundV2 };
  },
}));

import { retrieveCheckoutForm } from "./iyzico.client";

describe("iyzico retrieve network retry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("retries a transient network failure and returns the next successful response", async () => {
    vi.useFakeTimers();
    sdk.retrieve
      .mockImplementationOnce((_request, callback) => callback(Object.assign(new Error("reset"), { code: "ECONNRESET" })))
      .mockImplementationOnce((_request, callback) => callback(null, {
        status: "success",
        paymentStatus: "SUCCESS",
        token: "token-1",
        basketId: "GS1",
        price: "100",
        paidPrice: "100",
      }));

    const resultPromise = retrieveCheckoutForm("token-1");
    await vi.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toMatchObject({ paymentStatus: "SUCCESS", basketId: "GS1" });
    expect(sdk.retrieve).toHaveBeenCalledTimes(2);
  });

  it("does not retry a provider validation error", async () => {
    sdk.retrieve.mockImplementationOnce((_request, callback) => callback(Object.assign(new Error("invalid"), { code: "EINVAL" })));

    await expect(retrieveCheckoutForm("bad-token")).rejects.toThrow("invalid");
    expect(sdk.retrieve).toHaveBeenCalledTimes(1);
  });
});
