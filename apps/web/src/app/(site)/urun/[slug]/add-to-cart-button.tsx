"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateJson } from "@/lib/client-api";
import type { CartResponse, ProductVariant } from "@/lib/types";

interface Props {
  productId: number;
  variants: ProductVariant[];
}

// gulumsalim.com'daki .detail-options / .size-options / .quantity-selector
// yapısının birebir karşılığı.
export default function AddToCartButton({ productId, variants }: Props) {
  const router = useRouter();
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))], [variants]);
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter((c): c is string => !!c))], [variants]);

  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null);
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // bkz. kullanıcı isteği: "ürün sepete eklendiğinde o buton değişsin" -
  // buton birkaç saniyeliğine yeşil "Sepete Eklendi" durumuna geçer.
  const [justAdded, setJustAdded] = useState(false);

  const hasVariants = variants.length > 0;
  const matchedVariant = hasVariants
    ? variants.find(
        (v) => (sizes.length === 0 || v.size === selectedSize) && (colors.length === 0 || v.color === selectedColor),
      )
    : undefined;
  const outOfStock = hasVariants && (!matchedVariant || matchedVariant.stock <= 0);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      await mutateJson<CartResponse>("/cart/items", "POST", {
        productId,
        variantId: matchedVariant?.id,
        quantity,
      });
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 2500);
      router.refresh();
    } catch {
      setMessage("Sepete eklenemedi, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="detail-options">
      {sizes.length > 0 && (
        <div className="option-group">
          <div className="option-label">Beden</div>
          <div className="size-options">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`size-btn${selectedSize === size ? " active" : ""}`}
                onClick={() => setSelectedSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div className="option-group">
          <div className="option-label">Renk</div>
          <div className="size-options">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                className={`size-btn${selectedColor === color ? " active" : ""}`}
                onClick={() => setSelectedColor(color)}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedVariant?.priceOverride && (
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)", marginBottom: "0.75rem" }}>
          Bu seçenek için fiyat: {Number(matchedVariant.priceOverride).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </p>
      )}

      <div className="option-group">
        <div className="option-label">Miktar:</div>
        <div className="quantity-selector">
          <button type="button" className="qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
            -
          </button>
          <input className="qty-input" value={quantity} readOnly />
          <button type="button" className="qty-btn" onClick={() => setQuantity((q) => q + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="detail-actions">
        <button
          className={`btn btn-lg ${justAdded ? "btn-added" : "btn-primary"}`}
          onClick={handleClick}
          disabled={loading || outOfStock}
        >
          {outOfStock ? (
            "Stokta Yok"
          ) : justAdded ? (
            <>
              <i className="fas fa-check" /> Sepete Eklendi
            </>
          ) : loading ? (
            "Ekleniyor..."
          ) : (
            "Sepete Ekle"
          )}
        </button>
      </div>
      {message && <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{message}</p>}
    </div>
  );
}
