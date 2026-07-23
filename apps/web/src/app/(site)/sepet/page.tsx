"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { CartResponse } from "@/lib/types";

function lineId(productId: number, variantId?: number) {
  return `${productId}:${variantId ?? 0}`;
}

const DEFAULT_FREE_SHIPPING_THRESHOLD = 500;

// gulumsalim.com'daki .cart-section / .cart-grid / .cart-item yapısının
// birebir karşılığı.
export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(DEFAULT_FREE_SHIPPING_THRESHOLD);

  async function load() {
    const data = await fetchJson<CartResponse>("/cart");
    setCart(data);
  }

  useEffect(() => {
    load();
    // admin panelden değiştirilebilen ücretsiz kargo limiti - bkz.
    // checkout.service.ts'teki aynı ayarın kullanıldığı yer.
    fetchJson<{ free_shipping_limit?: string }>("/site-settings")
      .then((s) => {
        if (s.free_shipping_limit) setFreeShippingThreshold(Number(s.free_shipping_limit));
      })
      .catch(() => {});
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

  const subtotal = cart ? Number(cart.subtotal) : 0;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">Alışveriş Sepetim</span>
          </div>
        </div>
      </div>

      <section className="cart-section">
        <div className="container">
          <h1 className="page-title">Alışveriş Sepetim</h1>

          {cart === null ? (
            <p>Sepet yükleniyor...</p>
          ) : cart.items.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-shopping-bag" />
              <h2>Sepetiniz Henüz Boş</h2>
              <p>Mağazamızda yüzlerce yeni model ve indirimli ürün sizleri bekliyor.</p>
              <Link href="/urunler" className="btn btn-primary btn-lg">
                Alışverişe Başla
              </Link>
            </div>
          ) : (
            <div className="cart-grid">
              <div className="cart-items">
                {cart.items.map((item) => {
                  const id = lineId(item.productId, item.variantId);
                  const isBusy = busyLine === id;
                  return (
                    <div key={id} className="cart-item">
                      <div className="cart-item-image">
                        {item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.productName} />
                        )}
                      </div>
                      <div className="cart-item-details">
                        <div className="cart-item-name">
                          <Link href={`/urun/${item.productSlug}`}>{item.productName}</Link>
                        </div>
                        {item.variantLabel && <div className="cart-item-variant">{item.variantLabel}</div>}
                        <div className="quantity-selector">
                          <button
                            type="button"
                            className="qty-btn"
                            disabled={isBusy}
                            onClick={() => updateQuantity(item.productId, item.variantId, Math.max(1, item.quantity - 1))}
                          >
                            -
                          </button>
                          <input className="qty-input" value={item.quantity} readOnly />
                          <button
                            type="button"
                            className="qty-btn"
                            disabled={isBusy}
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="cart-item-price">
                          {Number(item.lineTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                        </div>
                        <button
                          className="cart-item-remove"
                          disabled={isBusy}
                          onClick={() => removeLine(item.productId, item.variantId)}
                          aria-label="Kaldır"
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cart-summary">
                <h3>Sipariş Özeti</h3>

                <div className="free-shipping-bar">
                  <div className="free-shipping-progress" style={{ width: `${progress}%` }} />
                </div>
                <div className="free-shipping-text">
                  {remaining > 0
                    ? `Ücretsiz kargo için ${remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ daha ekleyin`
                    : "Ücretsiz kargo kazandınız!"}
                </div>

                <div className="summary-row">
                  <span>Ara Toplam</span>
                  <span>{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>
                <div className="summary-row total">
                  <span>Toplam</span>
                  <span>{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>

                <Link href="/odeme" className="btn btn-primary btn-block">
                  Ödemeye Geç
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
