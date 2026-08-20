import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../orders/iyzico.client", () => ({
  refundItemPayment: vi.fn(),
  refundPayment: vi.fn(),
  verifyRefundSignature: vi.fn(() => true),
}));
vi.mock("./admin-refunds.repository", () => ({
  claimRefundForRelease: vi.fn(),
  commitRefundRelease: vi.fn(),
  resetRefundReleaseClaim: vi.fn(),
  MissingPaymentInfoError: class extends Error {},
}));

import { refundItemPayment, refundPayment } from "../orders/iyzico.client";
import { claimRefundForRelease, commitRefundRelease, resetRefundReleaseClaim } from "./admin-refunds.repository";
import { RefundApiError, releaseRefund } from "./admin-refunds.service";

const info = {
  refundId: 1, orderItemId: 2, vendorId: 3, itemTotal: "50.00",
  refundTarget: { mode: "item" as const, id: "item-tx" }, vendorNetEarning: "40.00",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(claimRefundForRelease).mockResolvedValue(info);
  vi.mocked(commitRefundRelease).mockResolvedValue({ id: 1 } as never);
});

describe("releaseRefund", () => {
  it("uses item-level refund and commits only after a signed provider success", async () => {
    vi.mocked(refundItemPayment).mockResolvedValue({ status: "success" } as never);
    await expect(releaseRefund(1, "1.2.3.4")).resolves.toEqual({ id: 1 });
    expect(refundItemPayment).toHaveBeenCalledWith({ paymentTransactionId: "item-tx", price: "50.00", ip: "1.2.3.4" });
    expect(refundPayment).not.toHaveBeenCalled();
    expect(commitRefundRelease).toHaveBeenCalledWith(1, 2, 3, "40.00");
  });

  it("does not automatically retry or unlock an ambiguous network result", async () => {
    vi.mocked(refundItemPayment).mockRejectedValue(new Error("timeout"));
    await expect(releaseRefund(1, "1.2.3.4")).rejects.toBeInstanceOf(RefundApiError);
    expect(resetRefundReleaseClaim).not.toHaveBeenCalled();
    expect(commitRefundRelease).not.toHaveBeenCalled();
  });

  it("unlocks only an explicitly retryable provider failure", async () => {
    vi.mocked(refundItemPayment).mockResolvedValue({ status: "failure", retryable: true, errorMessage: "retry" });
    await expect(releaseRefund(1, "1.2.3.4")).rejects.toBeInstanceOf(RefundApiError);
    expect(resetRefundReleaseClaim).toHaveBeenCalledWith(1);
  });
});
