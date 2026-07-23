import { describe, expect, it } from "vitest";
import { addToCart, removeCartItem, updateCartItem } from "./cart.service";
import type { CartLine } from "./cart.types";

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
