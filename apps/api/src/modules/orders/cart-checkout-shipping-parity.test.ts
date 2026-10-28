import { beforeEach, describe, expect, it, vi } from "vitest";

// bkz. kargo/PTT denetim raporu Faz 3.1 (2026-09-10): "Sepet (cart) ve
// checkout (checkout) aynı sepet için aynı shipping business rule'larını
// kullanmalı" düzeltmesinin doğrudan regresyon testi. checkout-totals.ts
// kampanya kaynaklı freeShippingVendorIds'i her zaman dahil ediyordu,
// cart.service.ts ETMİYORDU - bu dosya, AYNI girdi (ürünler + aktif
// kampanyalar + shipping settings) için hydrateCart() ve resolveCheckoutTotals()
// sonuçlarının artık BİREBİR eşit olduğunu doğrudan karşılaştırarak kanıtlar.
vi.mock("../content/content.repository", () => ({
  getPublicSettings: vi.fn(async () => ({ shipping_cost: "49.90", free_shipping_limit: "500" })),
}));
vi.mock("./campaign.repository", () => ({ listActiveCampaigns: vi.fn().mockResolvedValue([]) }));
vi.mock("./coupon.service", () => ({ validateAndComputeDiscount: vi.fn() }));
vi.mock("../cart/cart.repository", () => ({
  fetchProductsForCart: vi.fn(),
  fetchVariantsForCart: vi.fn().mockResolvedValue([]),
  fetchPrimaryImages: vi.fn().mockResolvedValue([]),
}));

import { listActiveCampaigns } from "./campaign.repository";
import { resolveCheckoutTotals, type CheckoutProductInfo } from "./checkout-totals";
import { fetchProductsForCart } from "../cart/cart.repository";
import { hydrateCart } from "../cart/cart.service";

const VENDOR_A = 11;
const VENDOR_B = 22;
const CATEGORY = 3;

// Aynı iki ürünü (Satıcı A: 100 TL, Satıcı B: 100 TL) hem cart hem checkout
// tarafının kendi veri şekliyle besler - böylece iki AYRI kod yolu (cart.
// repository satırları vs checkout productMap) gerçekten AYNI ürün/satıcı
// senaryosunu temsil eder.
function cartFixture() {
  return [
    { id: 1, name: "A ürün", slug: "a-urun", basePrice: "100.00", status: "active" as const, vendorId: VENDOR_A, categoryId: CATEGORY, storeName: "Mağaza A", vendorStatus: "active" as const, freeShipping: false, stock: 10 },
    { id: 2, name: "B ürün", slug: "b-urun", basePrice: "100.00", status: "active" as const, vendorId: VENDOR_B, categoryId: CATEGORY, storeName: "Mağaza B", vendorStatus: "active" as const, freeShipping: false, stock: 10 },
  ];
}

function checkoutFixture(): [{ productId: number; lineTotal: string }[], Map<number, CheckoutProductInfo>] {
  const items = [
    { productId: 1, lineTotal: "100.00" },
    { productId: 2, lineTotal: "100.00" },
  ];
  const productMap = new Map<number, CheckoutProductInfo>([
    [1, { vendorId: VENDOR_A, categoryId: CATEGORY, freeShipping: false, storeName: "Mağaza A" }],
    [2, { vendorId: VENDOR_B, categoryId: CATEGORY, freeShipping: false, storeName: "Mağaza B" }],
  ]);
  return [items, productMap];
}

async function runBoth() {
  vi.mocked(fetchProductsForCart).mockResolvedValue(cartFixture());
  const cart = await hydrateCart([
    { productId: 1, quantity: 1 },
    { productId: 2, quantity: 1 },
  ]);
  const [items, productMap] = checkoutFixture();
  const checkout = await resolveCheckoutTotals(items, productMap, undefined, undefined);
  return { cart, checkout };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listActiveCampaigns).mockResolvedValue([]);
});

describe("cart/checkout shipping parity", () => {
  it("kampanyasız sipariş: cart ve checkout shipping sonucu birebir eşit", async () => {
    const { cart, checkout } = await runBoth();
    expect(Number(cart.shippingFee)).toBe(checkout.shippingFee);
    expect(cart.shippingBreakdown).toEqual(checkout.shippingBreakdown);
    expect(cart.shippingFee).toBe("99.80"); // 2 satıcı × 49.90, ikisi de eşik altı
  });

  // bkz. rapor bölüm 5'teki senaryo: Seller A 100 TL + free-shipping kampanya,
  // Seller B 100 TL kampanyasız.
  it("tek satıcıya özel ücretsiz kargo kampanyası: cart VE checkout ikisinde de o satıcı 0, diğeri taban ücret", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 1, type: "free_shipping", scope: "vendor", scopeId: VENDOR_A, value: 0, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);
    const { cart, checkout } = await runBoth();

    expect(cart.shippingBreakdown).toEqual([
      { storeName: "Mağaza A", fee: "0.00", free: true },
      { storeName: "Mağaza B", fee: "49.90", free: false },
    ]);
    // Düzeltme ÖNCESİ: cart bu kampanyayı görmediği için Mağaza A'ya da
    // 49.90 uygulardı (shippingFee "99.80" olurdu) - şimdi checkout'la eşit.
    expect(Number(cart.shippingFee)).toBe(checkout.shippingFee);
    expect(cart.shippingBreakdown).toEqual(checkout.shippingBreakdown);
    expect(checkout.shippingFee).toBe(49.9);
  });

  it("tüm ürünler ürün-bazlı freeShipping bayrağıyla ücretsiz: cart ve checkout eşit (0)", async () => {
    vi.mocked(fetchProductsForCart).mockResolvedValue(
      cartFixture().map((p) => ({ ...p, freeShipping: true })),
    );
    const cart = await hydrateCart([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
    const [items] = checkoutFixture();
    const productMap = new Map<number, CheckoutProductInfo>([
      [1, { vendorId: VENDOR_A, categoryId: CATEGORY, freeShipping: true, storeName: "Mağaza A" }],
      [2, { vendorId: VENDOR_B, categoryId: CATEGORY, freeShipping: true, storeName: "Mağaza B" }],
    ]);
    const checkout = await resolveCheckoutTotals(items, productMap, undefined, undefined);

    expect(Number(cart.shippingFee)).toBe(0);
    expect(checkout.shippingFee).toBe(0);
    expect(cart.shippingBreakdown).toEqual(checkout.shippingBreakdown);
  });

  it("birden fazla satıcıya AYRI kampanyalar: her satıcı kendi kampanyasına göre değerlendirilir, cart/checkout eşit", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 1, type: "free_shipping", scope: "vendor", scopeId: VENDOR_A, value: 0, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
      { id: 2, type: "free_shipping", scope: "vendor", scopeId: VENDOR_B, value: 0, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);
    const { cart, checkout } = await runBoth();

    expect(cart.shippingBreakdown).toEqual([
      { storeName: "Mağaza A", fee: "0.00", free: true },
      { storeName: "Mağaza B", fee: "0.00", free: true },
    ]);
    expect(Number(cart.shippingFee)).toBe(checkout.shippingFee);
    expect(cart.shippingBreakdown).toEqual(checkout.shippingBreakdown);
  });

  it("kategori kapsamlı kampanya: cart da checkout gibi categoryId'ye göre değerlendirir (eşit sonuç)", async () => {
    vi.mocked(listActiveCampaigns).mockResolvedValue([
      { id: 1, type: "free_shipping", scope: "category", scopeId: CATEGORY, value: 0, minOrderAmount: null, startsAt: null, endsAt: null, isActive: true },
    ]);
    const { cart, checkout } = await runBoth();

    // İkisi de aynı kategoriden - kampanya tüm satıcılara uygulanır.
    expect(Number(cart.shippingFee)).toBe(0);
    expect(checkout.shippingFee).toBe(0);
    expect(cart.shippingBreakdown).toEqual(checkout.shippingBreakdown);
  });
});
