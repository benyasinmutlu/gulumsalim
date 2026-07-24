import { beforeEach, describe, expect, it, vi } from "vitest";

// handlePaymentCallback yolundaki bağımlılıklar mock'lanır; GERÇEK
// isVerifiedSuccessfulPayment (order-security.ts) test edilir — yani ödeme
// doğrulamasının service entegrasyonu, sadece helper değil (regresyon).
vi.mock("./order.repository", () => ({
  findOrderByPaymentRef: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderPaymentFailed: vi.fn(),
  findOrderItemsWithProductInfo: vi.fn(),
  createOrder: vi.fn(),
  fetchProductsForCheckout: vi.fn(),
  setOrderPaymentRef: vi.fn(),
  InsufficientStockError: class extends Error {},
}));
vi.mock("./iyzico.client", () => ({
  retrieveCheckoutForm: vi.fn(),
  initializeCheckoutForm: vi.fn(),
}));
vi.mock("../analytics/events.client", () => ({ emitBehavioralEvent: vi.fn() }));
vi.mock("../notifications/notifications.repository", () => ({ createNotification: vi.fn() }));

import { handlePaymentCallback } from "./checkout.service";
import {
  findOrderByPaymentRef,
  findOrderItemsWithProductInfo,
  markOrderPaid,
} from "./order.repository";
import { retrieveCheckoutForm } from "./iyzico.client";
import { emitBehavioralEvent } from "../analytics/events.client";

const fakeApp = { log: { warn: vi.fn() } } as unknown as Parameters<typeof handlePaymentCallback>[0];

const baseOrder = {
  id: 1,
  customerId: 7,
  orderNumber: "GS-8ccdb3ab-c640-4fb6-93c7-2e100b66d4c4",
  paymentRef: "provider-token",
  subtotal: "100.00",
  total: "149.90",
  paymentStatus: "pending",
};

const matchingResult = {
  status: "success",
  paymentStatus: "SUCCESS",
  token: "provider-token",
  basketId: baseOrder.orderNumber,
  price: "100",
  paidPrice: "149.9",
};

beforeEach(() => vi.clearAllMocks());

describe("handlePaymentCallback", () => {
  it("returns null for an unknown provider token", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(null as never);

    const out = await handlePaymentCallback(fakeApp, "unknown");

    expect(out).toBeNull();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("does NOT mark paid when the provider amount does not match the stored order", async () => {
    // Tutar manipülasyonu: sağlayıcı 1.00 TL ödendi diyor, sipariş 149.90.
    vi.mocked(retrieveCheckoutForm).mockResolvedValue({ ...matchingResult, paidPrice: "1.00" } as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);

    const out = await handlePaymentCallback(fakeApp, "provider-token");

    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(emitBehavioralEvent).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: false });
  });

  it("rejects a callback whose token does not belong to the order", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue({ ...matchingResult, token: "attacker-token" } as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);

    const out = await handlePaymentCallback(fakeApp, "provider-token");

    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: false });
  });

  it("marks paid and emits one purchase event per item on a verified matching success", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);
    vi.mocked(markOrderPaid).mockResolvedValue(true);
    vi.mocked(findOrderItemsWithProductInfo).mockResolvedValue([
      { productId: 11, vendorId: 3, categoryId: 9 },
      { productId: 12, vendorId: 3, categoryId: 9 },
    ] as never);

    const out = await handlePaymentCallback(fakeApp, "provider-token");

    expect(markOrderPaid).toHaveBeenCalledWith(baseOrder.id);
    expect(emitBehavioralEvent).toHaveBeenCalledTimes(2);
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: true });
  });

  it("is idempotent: a duplicate callback on an already-paid order does not re-emit events", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue({ ...baseOrder, paymentStatus: "paid" } as never);
    // Koşullu update kimseyi pending->paid geçirmedi (zaten paid).
    vi.mocked(markOrderPaid).mockResolvedValue(false);

    const out = await handlePaymentCallback(fakeApp, "provider-token");

    expect(emitBehavioralEvent).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: true });
  });
});
