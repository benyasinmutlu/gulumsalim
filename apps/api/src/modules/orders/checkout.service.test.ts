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
  findOrderItemsForPayment: vi.fn(),
  createOrder: vi.fn(),
  fetchProductsForCheckout: vi.fn(),
  fetchVendorsForCheckout: vi.fn(),
  findOrderByCheckoutIdempotencyKey: vi.fn(),
  setOrderCheckoutPaymentData: vi.fn(),
  InsufficientStockError: class extends Error {},
}));
vi.mock("./iyzico.client", () => ({
  retrieveCheckoutForm: vi.fn(),
  initializeCheckoutForm: vi.fn(),
  refundPayment: vi.fn(),
  verifyCheckoutFormSignature: vi.fn(() => true),
}));
vi.mock("../analytics/events.client", () => ({ emitBehavioralEvent: vi.fn() }));
vi.mock("../notifications/notifications.repository", () => ({ createNotification: vi.fn() }));
vi.mock("../cart/cart.service", () => ({ hydrateCart: vi.fn() }));
vi.mock("./checkout-totals", () => ({ resolveCheckoutTotals: vi.fn() }));
vi.mock("../auth/auth.repository", () => ({
  findCustomerById: vi.fn(),
  createGuestCustomer: vi.fn(),
  findCustomerByEmail: vi.fn(),
  updateGuestCustomerContact: vi.fn(),
}));
vi.mock("../../lib/mailer", () => ({ sendMail: vi.fn() }));

import { handlePaymentCallback, InvalidContractAcceptanceError, startCheckout } from "./checkout.service";
import {
  createOrder,
  fetchProductsForCheckout,
  fetchVendorsForCheckout,
  findOrderByPaymentRef,
  findOrderItemsForDetail,
  findOrderItemsForPayment,
  findOrderItemsWithProductInfo,
  markOrderPaid,
} from "./order.repository";
import { retrieveCheckoutForm } from "./iyzico.client";
import { emitBehavioralEvent } from "../analytics/events.client";
import { createGuestCustomer, findCustomerByEmail, findCustomerById } from "../auth/auth.repository";
import { hydrateCart } from "../cart/cart.service";
import { resolveCheckoutTotals } from "./checkout-totals";
import { createContractAcceptanceToken } from "./checkout-security";

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
  fraudStatus: 1,
  token: "provider-token",
  basketId: baseOrder.orderNumber,
  price: "100",
  paidPrice: "149.9",
  paymentId: "pay-1",
  currency: "TRY",
  conversationId: "conv-1",
  signature: "a".repeat(64),
  itemTransactions: [{ itemId: "item-ref-1", paymentTransactionId: "tx-1" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findOrderItemsForPayment).mockResolvedValue([{ id: 21, productId: 11, paymentItemRef: "item-ref-1" }] as never);
});

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
    expect(markOrderPaid).toHaveBeenCalledWith(baseOrder.id, "pay-1", [{ orderItemId: 21, paymentTransactionId: "tx-1" }]);
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
    vi.mocked(findOrderByPaymentRef)
      .mockResolvedValueOnce(baseOrder as never)
      .mockResolvedValueOnce({ ...baseOrder, paymentStatus: "paid" } as never);
    vi.mocked(markOrderPaid).mockResolvedValue(false); // eşzamanlı callback geçişi kazandı
    vi.mocked(findOrderItemsWithProductInfo).mockResolvedValue([{ productId: 11, variantId: null, vendorId: 3, categoryId: 9 }] as never);
    const out = await handlePaymentCallback(fakeApp, "provider-token");
    expect(emitBehavioralEvent).not.toHaveBeenCalled();
    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: true, purchasedLines: [{ productId: 11, variantId: undefined }] });
  });

  it("does not report success when a failed state wins the payment race", async () => {
    vi.mocked(retrieveCheckoutForm).mockResolvedValue(matchingResult as never);
    vi.mocked(findOrderByPaymentRef)
      .mockResolvedValueOnce(baseOrder as never)
      .mockResolvedValueOnce({ ...baseOrder, paymentStatus: "failed" } as never);
    vi.mocked(markOrderPaid).mockResolvedValue(false);

    const out = await handlePaymentCallback(fakeApp, "provider-token");

    expect(out).toEqual({ orderNumber: baseOrder.orderNumber, success: false });
    expect(emitBehavioralEvent).not.toHaveBeenCalled();
  });
});

describe("startCheckout contract gate", () => {
  const address = {
    fullName: "Test Müşteri",
    phone: "05550000000",
    city: "İstanbul",
    district: "Beyoğlu",
    addressLine: "Test Mahallesi No: 1",
  };

  function prepareCheckoutMocks() {
    vi.mocked(findCustomerByEmail).mockResolvedValue(null as never);
    vi.mocked(hydrateCart).mockResolvedValue({
      items: [{
        productId: 11,
        productName: "Test Ürün",
        productSlug: "test-urun",
        image: null,
        unitPrice: "100.00",
        quantity: 1,
        lineTotal: "100.00",
      }],
    } as never);
    vi.mocked(fetchProductsForCheckout).mockResolvedValue([
      { id: 11, vendorId: 3, categoryId: 9, status: "active", vendorStatus: "approved", freeShipping: false, storeName: "Test Mağaza" },
    ] as never);
    vi.mocked(fetchVendorsForCheckout).mockResolvedValue([
      { id: 3, storeName: "Test Mağaza", fullName: "Test Satıcı", vendorType: "individual", taxId: null, legalAddress: null },
    ] as never);
    vi.mocked(resolveCheckoutTotals).mockResolvedValue({
      subtotal: 100,
      shippingFee: 0,
      shippingBreakdown: [],
      freeShippingThreshold: 500,
      discountAmount: 0,
      total: 100,
      couponId: null,
      couponCode: null,
      campaignId: null,
    });
  }

  it("does not create a guest account when contract acceptance is invalid", async () => {
    prepareCheckoutMocks();

    await expect(
      startCheckout(
        undefined,
        [{ productId: 11, quantity: 1 }],
        address,
        "guest@example.com",
        undefined,
        true,
        undefined,
        "12345678901",
        "127.0.0.1",
        "invalid-token",
        "session-binding",
        "checkout-key-123456789",
      ),
    ).rejects.toBeInstanceOf(InvalidContractAcceptanceError);

    expect(createGuestCustomer).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("rejects an acceptance token issued for a different product variant", async () => {
    prepareCheckoutMocks();
    const token = createContractAcceptanceToken({
      version: 1,
      sessionBinding: "session-binding",
      identityNumber: "12345678901",
      cartLines: [{ productId: 11, variantId: 101, quantity: 1 }],
      buyer: { ...address, email: "guest@example.com" },
      vendorBlocks: [{
        vendorId: 3,
        storeName: "Test Mağaza",
        legalName: "Test Satıcı",
        taxId: null,
        legalAddress: null,
        items: [{ productNameSnapshot: "Test Ürün", unitPrice: "100.00", quantity: 1, total: "100.00" }],
        lineTotal: "100.00",
      }],
      subtotal: "100.00",
      shippingFee: "0.00",
      couponCode: null,
      discountAmount: "0.00",
      total: "100.00",
    });

    await expect(
      startCheckout(
        undefined,
        [{ productId: 11, variantId: 202, quantity: 1 }],
        address,
        "guest@example.com",
        undefined,
        true,
        undefined,
        "12345678901",
        "127.0.0.1",
        token,
        "session-binding",
        "checkout-key-123456789",
      ),
    ).rejects.toBeInstanceOf(InvalidContractAcceptanceError);

    expect(createGuestCustomer).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });
});
