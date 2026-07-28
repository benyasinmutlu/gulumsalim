import { fetchPrimaryImages, fetchProductsForCart, fetchVariantsForCart } from "./cart.repository";
import { getShippingConfig } from "../../lib/shipping";
import type { CartLine } from "./cart.types";

function lineKey(line: Pick<CartLine, "productId" | "variantId">): string {
  return `${line.productId}:${line.variantId ?? 0}`;
}

export function addToCart(cart: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  const existing = cart.find((c) => lineKey(c) === key);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + line.quantity, 20);
    return cart;
  }
  return [...cart, line];
}

export function updateCartItem(cart: CartLine[], line: CartLine): CartLine[] {
  const key = lineKey(line);
  if (line.quantity === 0) {
    return cart.filter((c) => lineKey(c) !== key);
  }
  const existing = cart.find((c) => lineKey(c) === key);
  if (existing) {
    existing.quantity = line.quantity;
    return cart;
  }
  return [...cart, line];
}

export function removeCartItem(cart: CartLine[], line: Pick<CartLine, "productId" | "variantId">): CartLine[] {
  const key = lineKey(line);
  return cart.filter((c) => lineKey(c) !== key);
}

// bkz. kullanıcı isteği: "Sepetinizdeki bazı ürünler artık uygun değil"
// uyarısı neden çıkıyor - kök neden: bu fonksiyon geçersiz (silinmiş/pasif
// ürün, silinmiş varyant) satırları sessizce ATLIYORDU ama session.cart'tan
// hiç SİLMİYORDU. Müşteri /sepet'i her ziyaret ettiğinde temiz bir liste
// görüyordu (hayalet satır hiç gösterilmiyordu, o yüzden düzeltecek bir şey
// yoktu), ama checkout.service.ts startCheckout içindeki
// `hydrated.items.length !== cart.length` kontrolü ham session.cart'ı
// kullandığı için HER denemede aynı hataya çarpıyordu - müşteri için
// çözümsüz görünen bir döngü. Artık geçerli satırlar da (`validCart`) ayrı
// döndürülüyor, çağıran taraf (cart.routes.ts) bunu session'a geri yazarak
// hayalet satırı gerçekten temizliyor.
// bkz. kullanıcı isteği: "kargo ücreti ne ise o yazsın" - sepet/ödeme
// sayfaları artık checkout ile TAMAMEN AYNI hesaplamayı (bkz. lib/shipping.ts)
// kullanarak gerçek kargo ücretini görüyor, önceden sadece checkout bunu
// biliyordu ve müşteriye hiç gösterilmiyordu.
export async function hydrateCart(cart: CartLine[]) {
  if (cart.length === 0) {
    const { shippingFee, freeShippingThreshold } = await getShippingConfig();
    return { items: [], subtotal: "0.00", validCart: [] as CartLine[], shippingFee: "0.00", freeShippingThreshold };
  }

  const productIds = [...new Set(cart.map((c) => c.productId))];
  const variantIds = [...new Set(cart.map((c) => c.variantId).filter((id): id is number => id !== undefined))];

  const [productRows, variantRows, imageRows] = await Promise.all([
    fetchProductsForCart(productIds),
    fetchVariantsForCart(variantIds),
    fetchPrimaryImages(productIds),
  ]);

  const productMap = new Map(productRows.map((p) => [p.id, p]));
  const variantMap = new Map(variantRows.map((v) => [v.id, v]));
  const imageMap = new Map(imageRows.map((i) => [i.productId, i.url]));

  let subtotal = 0;
  const items: Array<{
    productId: number;
    productName: string;
    productSlug: string;
    variantId?: number;
    variantLabel?: string;
    image: string | null;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }> = [];
  const validCart: CartLine[] = [];

  for (const line of cart) {
    const product = productMap.get(line.productId);
    // Ürün silinmiş/pasife alınmışsa ya da satıcı askıya alınmışsa sepette
    // sessizce görünmez olur - checkout aşamasında zaten yeniden doğrulanır.
    if (!product || product.status !== "active" || product.vendorStatus !== "active") continue;

    const variant = line.variantId ? variantMap.get(line.variantId) : undefined;
    if (line.variantId && !variant) continue;

    const unitPrice = variant?.priceOverride ?? product.basePrice;
    const lineTotal = Number(unitPrice) * line.quantity;
    subtotal += lineTotal;

    items.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantId: variant?.id,
      variantLabel: variant ? [variant.size, variant.color].filter(Boolean).join(" / ") : undefined,
      image: imageMap.get(product.id) ?? null,
      unitPrice,
      quantity: line.quantity,
      lineTotal: lineTotal.toFixed(2),
    });
    validCart.push(line);
  }

  const { shippingFee: baseShippingFee, freeShippingThreshold } = await getShippingConfig();
  const allItemsFreeShipping = items.length > 0 && items.every((item) => productMap.get(item.productId)?.freeShipping === true);
  const shippingFee = items.length === 0 || allItemsFreeShipping || subtotal >= freeShippingThreshold ? 0 : baseShippingFee;

  return { items, subtotal: subtotal.toFixed(2), validCart, shippingFee: shippingFee.toFixed(2), freeShippingThreshold };
}
