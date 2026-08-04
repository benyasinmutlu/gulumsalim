import { beforeEach, describe, expect, it, vi } from "vitest";

// handlePaymentCallback yolundaki bağımlılıklar mock'lanır; GERÇEK
// isVerifiedSuccessfulPayment (order-security.ts) test edilir — ödeme
// doğrulamasının service entegrasyonu (yalnız helper değil) regresyonu.
vi.mock("./order.repository", () => ({
  findOrderByPaymentRef: vi.fn(),
  markOrderPaid: vi.fn(),
  markOrderPaymentFailed: vi.fn(),
  findOrderItemsWithProductInfo: vi.fn(),
  findOrderItemsForDetail: vi.fn(),
  createOrder: vi.fn(),
  fetchProductsForCheckout: vi.fn(),
  setOrderPaymentRef: vi.fn(),
  InsufficientStockError: class extends Error {},
}));
vi.mock("./iyzico.client", () => ({
  retrieveCheckoutForm: vi.fn(),
  initializeCheckoutForm: vi.fn(),
  refundPayment: vi.fn(),
}));
vi.mock("../analytics/events.client", () => ({ emitBehavioralEvent: vi.fn() }));
vi.mock("../notifications/notifications.repository", () => ({ createNotification: vi.fn() }));
vi.mock("../auth/auth.repository", () => ({
  findCustomerById: vi.fn(),
  createGuestCustomer: vi.fn(),
  findCustomerByEmail: vi.fn(),
  updateGuestCustomerContact: vi.fn(),
}));
vi.mock("../../lib/mailer", () => ({ sendMail: vi.fn() }));

import { handlePaymentCallback } from "./checkout.service";
import {
  findOrderByPaymentRef,
  findOrderItemsForDetail,
  findOrderItemsWithProductInfo,
  markOrderPaid,
} from "./order.repository";
import { retrieveCheckoutForm } from "./iyzico.client";
import { emitBehavioralEvent } from "../analytics/events.client";
import { findCustomerById } from "../auth/auth.repository";

const fakeApp = { log: { warn: vi.fn() } } as unknown as Parameters<typeof handlePaymentCallback>[0];

const baseOrder = {
  id: 1,
  customerId: 7,
  orderNumber: "GS17000000001",
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
  paymentId: "pay-1",
};

beforeEach(() => vi.clearAllMocks());

describe("handlePaymentCallback (app/ canonical)", () => {
  it("returns null for an unknown provider token", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(null as never);
    expect(await handlePaymentCallback(fakeApp, "unknown")).toBeNull();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("is idempotent for an already-paid order (no re-emit)", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue({ ...baseOrder, paymentStatus: "paid" } as never);
    vi.mocked(findOrderItemsWithProductInfo).mockResolvedValue([{ productId: 11, variantId: null, vendorId: 3, categoryId: 9 }] as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: true, purchasedLines: [{ productId: 11, variantId: undefined }] });
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(emitBehavioralEvent).not.toHaveBeenCalled();
  });

  it("does NOT mark paid when the provider amount does not match", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue({ ...matchingResult, paidPrice: "1.00" } as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: false });
  });

  it("rejects a callback whose token does not belong to the order", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue({ ...matchingResult, token: "attacker-token" } as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(markOrderPaid).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: false });
  });

  it("marks paid and emits one purchase event per item on a verified success", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);
    vi.mocked(markOrderPaid).mockResolvedValue(true);
    vi.mocked(findOrderItemsWithProductInfo).mockResolvedValue([
      { productId: 11, variantId: 101, vendorId: 3, categoryId: 9 },
      { productId: 12, variantId: null, vendorId: 3, categoryId: 9 },
    ] as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(markOrderPaid).toHaveBeenCalledWith(baseOrder.id, "pay-1");
    expect(emitBehavioralEvent).toHaveBeenCalledTimes(2);
    expect(out).toEqual({
      orderNumber: baseOrder.orderNumber,
      success: true,
      purchasedLines: [
        { productId: 11, variantId: 101 },
        { productId: 12, variantId: undefined },
      ],
    });
  });

  it("does not re-emit when the conditional transition is lost (race)", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef).mockResolvedValue(baseOrder as never);
    vi.mocked(markOrderPaid).mockResolvedValue(false); // eşzamanlı callback geçişi kazandı
    vi.mocked(findOrderItemsWithProductInfo).mockResolvedValue([{ productId: 11, variantId: null, vendorId: 3, categoryId: 9 }] as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(emitBehavioralEvent).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: true, purchasedLines: [{ productId: 11, variantId: undefined }] });
  });
});
