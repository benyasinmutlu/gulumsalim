"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { CartResponse } from "@/lib/types";

function lineId(productId: number, variantId?: number) {
  return `${productId}:${variantId ?? 0}`;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);

  async function load() {
    const data = await fetchJson<CartResponse>("/cart");
    setCart(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateQuantity(productId: number, variantId: number | undefined, quantity: number) {
    setBusyLine(lineId(productId, variantId));
    try {
      const updated = await mutateJson<CartResponse>("/cart/items", "PATCH", { productId, variantId, quantity });
      setCart(updated);
    } finally {
      setBusyLine(null);
    }
  }

  async function removeLine(productId: number, variantId: number | undefined) {
    setBusyLine(lineId(productId, variantId));
    try {
      const updated = await mutateJson<CartResponse>("/cart/items", "DELETE", { productId, variantId });
      setCart(updated);
    } finally {
      setBusyLine(null);
    }
  }

  if (cart === null) {
    return (
      <main className="container" style={{ paddingBlock: "2.5rem" }}>
        <p>Sepet yükleniyor...</p>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem" }}>Sepetim</h1>

      {cart.items.length === 0 ? (
        <p className="empty-state">
          Sepetiniz boş. <Link href="/urunler">Ürünlere göz atın</Link>.
        </p>
      ) : (
        <>
          <div style={{ marginTop: "1.5rem" }}>
            {cart.items.map((item) => {
              const id = lineId(item.productId, item.variantId);
              const isBusy = busyLine === id;
              return (
                <div key={id} className="cart-line">
                  <div>
                    <div>
                      <Link href={`/urun/${item.productSlug}`}>{item.productName}</Link>
                    </div>
                    {item.variantLabel && (
                      <div style={{ fontSize: "0.8rem", opacity: 0.65 }}>{item.variantLabel}</div>
                    )}
                    <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                      {Number(item.unitPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ x{" "}
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={item.quantity}
                        disabled={isBusy}
                        onChange={(e) => updateQuantity(item.productId, item.variantId, Number(e.target.value))}
                        style={{ width: "3.5rem" }}
                      />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="price">
                      {Number(item.lineTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: "0.4rem", fontSize: "0.8rem" }}
                      disabled={isBusy}
                      onClick={() => removeLine(item.productId, item.variantId)}
                    >
                      Kaldır
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="price" style={{ fontSize: "1.1rem" }}>
              Ara Toplam: {Number(cart.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
            </span>
            <Link href="/odeme" className="btn">
              Ödemeye Geç
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
