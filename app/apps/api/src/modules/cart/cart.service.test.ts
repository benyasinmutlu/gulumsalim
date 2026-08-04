import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToCart, removeCartItem, updateCartItem } from "./cart.service";
import type { CartLine } from "./cart.types";

// bkz. kullanıcı isteği: "stok durumu sürekli kontrol ettirilmeli hem
// sepette hemde ödeme yapılırken 14 tane şort etek var 30 tane alabiliyorum
// bu olmamalı" - hydrateCart'ın gerçek stoğa göre miktarı kırptığının
// regresyon testi (bkz. checkout.service.test.ts aynı mock deseni).
vi.mock("./cart.repository", () => ({
  fetchProductsForCart: vi.fn(),
  fetchVariantsForCart: vi.fn(),
  fetchPrimaryImages: vi.fn(),
}));
// getShippingConfig sabitlenir ama computeMultiVendorShipping GERÇEK kalır -
// satıcı-bazlı kargo hesabını gerçekten test edebilmek için (mock modül
// aksi halde onu undefined yapardı).
vi.mock("../../lib/shipping", async (importActual) => ({
  ...(await importActual<typeof import("../../lib/shipping")>()),
  getShippingConfig: vi.fn().mockResolvedValue({ shippingFee: 49.9, freeShippingThreshold: 500 }),
}));

describe("addToCart", () => {
  it("boş sepete yeni bir satır ekler", () => {
    const result = addToCart([], { productId: 1, quantity: 2 });
    expect(result).toEqual([{ productId: 1, quantity: 2 }]);
  });

  it("aynı ürün+varyant tekrar eklenince adetleri toplar", () => {
    const cart: CartLine[] = [{ productId: 1, variantId: 5, quantity: 2 }];
    const result = addToCart(cart, { productId: 1, variantId: 5, quantity: 3 });
    expect(result).toEqual([{ productId: 1, variantId: 5, quantity: 5 }]);
  });

  it("aynı ürün farklı varyantta ayrı bir satır olarak eklenir", () => {
    const cart: CartLine[] = [{ productId: 1, variantId: 5, quantity: 1 }];
    const result = addToCart(cart, { productId: 1, variantId: 6, quantity: 1 });
    expect(result).toHaveLength(2);
  });

  it("adet üst sınırı 20'yi asla aşmaz", () => {
    const cart: CartLine[] = [{ productId: 1, quantity: 18 }];
    const result = addToCart(cart, { productId: 1, quantity: 10 });
    expect(result[0]?.quantity).toBe(20);
  });
});

describe("updateCartItem", () => {
  it("adet 0 olunca satırı sepetten kaldırır", () => {
    const cart: CartLine[] = [{ productId: 1, quantity: 2 }];
    const result = updateCartItem(cart, { productId: 1, quantity: 0 });
    expect(result).toEqual([]);
  });

  it("mevcut bir satırın adedini doğrudan (toplamadan) değiştirir", () => {
    const cart: CartLine[] = [{ productId: 1, quantity: 2 }];
    const result = updateCartItem(cart, { productId: 1, quantity: 7 });
    expect(result).toEqual([{ productId: 1, quantity: 7 }]);
  });

  it("sepette olmayan bir satır için update, ekleme gibi davranır", () => {
    const result = updateCartItem([], { productId: 9, quantity: 1 });
    expect(result).toEqual([{ productId: 9, quantity: 1 }]);
  });
});

describe("removeCartItem", () => {
  it("sadece eşleşen ürün+varyant satırını kaldırır, diğerlerini korur", () => {
    const cart: CartLine[] = [
      { productId: 1, variantId: 5, quantity: 1 },
      { productId: 1, variantId: 6, quantity: 1 },
      { productId: 2, quantity: 1 },
    ];
    const result = removeCartItem(cart, { productId: 1, variantId: 5 });
    expect(result).toEqual([
      { productId: 1, variantId: 6, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
  });
});

describe("hydrateCart", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchProductsForCart, fetchVariantsForCart, fetchPrimaryImages } = await import("./cart.repository");
    vi.mocked(fetchProductsForCart).mockResolvedValue([
      { id: 1, name: "Şort Etek", slug: "sort-etek", basePrice: "1500.00", status: "active", vendorId: 11, storeName: "Butik 11", vendorStatus: "active", freeShipping: false, stock: 0 },
    ]);
    vi.mocked(fetchPrimaryImages).mockResolvedValue([]);
    vi.mocked(fetchVariantsForCart).mockResolvedValue([
      { id: 10, productId: 1, priceOverride: null, stock: 14, size: "M", color: null },
    ]);
  });

  it("istenen miktar stoktan fazlaysa gerçek stoğa göre kırpar ve uyarı döner", async () => {
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([{ productId: 1, variantId: 10, quantity: 30 }]);
    expect(result.items[0]?.quantity).toBe(14);
    expect(result.validCart[0]?.quantity).toBe(14);
    expect(result.stockNotices).toEqual([{ productName: "Şort Etek", variantLabel: "M", availableStock: 14 }]);
  });

  it("stok yeterliyse miktarı olduğu gibi bırakır, uyarı üretmez", async () => {
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([{ productId: 1, variantId: 10, quantity: 5 }]);
    expect(result.items[0]?.quantity).toBe(5);
    expect(result.stockNotices).toEqual([]);
  });

  it("stok sıfırsa satırı sepetten tamamen düşürür", async () => {
    const { fetchVariantsForCart } = await import("./cart.repository");
    vi.mocked(fetchVariantsForCart).mockResolvedValue([
      { id: 10, productId: 1, priceOverride: null, stock: 0, size: "M", color: null },
    ]);
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([{ productId: 1, variantId: 10, quantity: 3 }]);
    expect(result.items).toEqual([]);
    expect(result.validCart).toEqual([]);
  });

  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli bireysel satıcıların ise stoğu 1 olacak" -
  // varyantsız ürünlerde de artık gerçek stok var (products.stock), aynı
  // kırpma kuralı onlara da uygulanmalı.
  it("varyantsız üründe miktarı products.stock'a göre kırpar", async () => {
    const { fetchProductsForCart, fetchVariantsForCart } = await import("./cart.repository");
    vi.mocked(fetchProductsForCart).mockResolvedValue([
      { id: 2, name: "El Yapımı Şal", slug: "el-yapimi-sal", basePrice: "300.00", status: "active", vendorId: 11, storeName: "Butik 11", vendorStatus: "active", freeShipping: false, stock: 1 },
    ]);
    vi.mocked(fetchVariantsForCart).mockResolvedValue([]);
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([{ productId: 2, quantity: 5 }]);
    expect(result.items[0]?.quantity).toBe(1);
    expect(result.stockNotices).toEqual([{ productName: "El Yapımı Şal", variantLabel: undefined, availableStock: 1 }]);
  });

  // bkz. kullanıcı kararı (2026-08-03): "her satıcının kargosu için ayrı ödeme
  // alınmalı, çoklu-satıcılı sepette dahi tek kargo ücreti olmaz".
  it("iki farklı satıcı, ikisi de eşiğin altında → satıcı başına ayrı kargo (2 × 49.90)", async () => {
    const { fetchProductsForCart, fetchVariantsForCart } = await import("./cart.repository");
    vi.mocked(fetchProductsForCart).mockResolvedValue([
      { id: 1, name: "A", slug: "a", basePrice: "100.00", status: "active", vendorId: 11, storeName: "Butik A", vendorStatus: "active", freeShipping: false, stock: 10 },
      { id: 2, name: "B", slug: "b", basePrice: "100.00", status: "active", vendorId: 22, storeName: "Butik B", vendorStatus: "active", freeShipping: false, stock: 10 },
    ]);
    vi.mocked(fetchVariantsForCart).mockResolvedValue([]);
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
    expect(result.shippingFee).toBe("99.80");
    expect(result.shippingBreakdown).toEqual([
      { storeName: "Butik A", fee: "49.90", free: false },
      { storeName: "Butik B", fee: "49.90", free: false },
    ]);
  });

  it("eşiği geçen satıcının kargosu ücretsiz, eşiğin altındaki satıcıya kargo eklenir", async () => {
    const { fetchProductsForCart, fetchVariantsForCart } = await import("./cart.repository");
    vi.mocked(fetchProductsForCart).mockResolvedValue([
      { id: 1, name: "A", slug: "a", basePrice: "600.00", status: "active", vendorId: 11, storeName: "Butik A", vendorStatus: "active", freeShipping: false, stock: 10 },
      { id: 2, name: "B", slug: "b", basePrice: "100.00", status: "active", vendorId: 22, storeName: "Butik B", vendorStatus: "active", freeShipping: false, stock: 10 },
    ]);
    vi.mocked(fetchVariantsForCart).mockResolvedValue([]);
    const { hydrateCart } = await import("./cart.service");
    const result = await hydrateCart([
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
    ]);
    expect(result.shippingFee).toBe("49.90");
  });
});
