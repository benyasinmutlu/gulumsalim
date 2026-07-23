"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, mutateJson } from "../lib/client-api";
import type { CartResponse, ProductDetail } from "../lib/types";

// Ürün kartlarının üzerinde beliren "hızlı sepete ekle" ikonu -
// gulumsalim.com'daki renderProductCardHTML()'in .product-action-btn'ine
// karşılık gelir. Kart linkine tıklanmasını engellemek için event
// propagation durduruluyor.
//
// Ürünün beden/renk gibi birden fazla varyantı varsa hangisinin
// isteneceği bilinmediğinden burada körlemesine eklenemez (yanlış/eksik
// varyantla sipariş oluşurdu) - bu durumda ürün detay sayfasına
// yönlendirilir, tıpkı /urun/[slug]'daki AddToCartButton'ın zorunlu
// beden/renk seçimi gibi.
export default function QuickAddButton({
  productId,
  productSlug,
  productHref,
}: {
  productId: number;
  productSlug: string;
  productHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const product = await fetchJson<ProductDetail>(`/products/${productSlug}`);
      if (product.variants.length > 1) {
        router.push(productHref);
        return;
      }
      const variant = product.variants[0];
      if (variant && variant.stock <= 0) {
        return;
      }
      await mutateJson<CartResponse>("/cart/items", "POST", { productId, variantId: variant?.id, quantity: 1 });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="product-action-btn"
      onClick={handleClick}
      disabled={loading}
      title="Hızlı Ekle"
      aria-label="Hızlı Ekle"
    >
      <i className="fas fa-shopping-bag" />
    </button>
  );
}
