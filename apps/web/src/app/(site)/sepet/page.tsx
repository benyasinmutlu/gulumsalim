"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { CartResponse, SiteStats } from "@/lib/types";
import { formatStatCount } from "@/lib/format-stat-count";

function lineId(productId: number, variantId?: number) {
  return `${productId}:${variantId ?? 0}`;
}

const DEFAULT_FREE_SHIPPING_THRESHOLD = 500;

function formatMoney(n: number) {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}

// gulumsalim.com'daki .cart-section / .cart-grid / .cart-item yapısının
// birebir karşılığı.
export default function CartPage() {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  // bkz. kullanıcı isteği (mockup): her ürünün yanında checkbox + "Tümünü
  // Seç" - sadece işaretli kalemler ödemeye gider, diğerleri sepette kalır
  // (bkz. checkout.routes.ts filterCartBySelection). Yeni yüklenen/eklenen
  // kalemler varsayılan olarak seçili sayılır.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [stockNotices, setStockNotices] = useState<CartResponse["stockNotices"]>([]);
  const [quote, setQuote] = useState<CartResponse | null>(null);
  const [siteStats, setSiteStats] = useState<SiteStats | null>(null);

  async function load() {
    const data = await fetchJson<CartResponse>("/cart");
    setCart(data);
    setStockNotices(data.stockNotices);
    setSelected((prev) => {
      const next = new Set(prev);
      const currentIds = new Set(data.items.map((i) => lineId(i.productId, i.variantId)));
      for (const id of currentIds) if (!prev.has(id)) next.add(id);
      // Sepetten çıkan kalemleri seçimden de temizle.
      for (const id of next) if (!currentIds.has(id)) next.delete(id);
      return next;
    });
  }

  useEffect(() => {
    load();
    // bkz. denetim raporu madde 4: boş sepet mesajındaki "yüzlerce yeni
    // model" iddiası sabitti - gerçek aktif ürün sayısıyla değiştirildi.
    fetchJson<SiteStats>("/site-stats")
      .then(setSiteStats)
      .catch(() => setSiteStats(null));
  }, []);

  // Seçili satırlar değiştiğinde backend'e yeniden fiyatlatılır. Kampanya
  // kapsamı, kupon minimumu ve satıcı-bazlı kargo frontend'de tahmin edilmez;
  // gerçek checkout ile aynı fiyat motorundan gelir.
  useEffect(() => {
    if (!cart || selected.size === 0) {
      setQuote(null);
      return;
    }
    const currentIds = cart.items.map((i) => lineId(i.productId, i.variantId));
    const selectedIds = currentIds.filter((id) => selected.has(id));
    if (selectedIds.length === 0) {
      setQuote(null);
      return;
    }
    const url = selectedIds.length === currentIds.length
      ? "/cart"
      : `/cart?selected=${encodeURIComponent(selectedIds.join(","))}`;
    let cancelled = false;
    fetchJson<CartResponse>(url)
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cart, selected]);

  function toggleLine(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!cart) return;
    const allIds = cart.items.map((i) => lineId(i.productId, i.variantId));
    const allSelected = allIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  // bkz. kullanıcı isteği: "kargo ücreti ne ise o yazsın" - artık
  // checkout ile birebir aynı hesaplamayı yapan GET /cart'ın döndürdüğü
  // gerçek değerler kullanılıyor (bkz. lib/shipping.ts), önceden burada
  // sadece eşik biliniyordu, ücretin kendisi hiç gösterilmiyordu.
  const pricedCart = quote ?? cart;
  const freeShippingThreshold = pricedCart?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD;
  const shippingFee = pricedCart ? Number(pricedCart.shippingFee) : 0;

  async function updateQuantity(productId: number, variantId: number | undefined, quantity: number) {
    setBusyLine(lineId(productId, variantId));
    try {
      const updated = await mutateJson<CartResponse>("/cart/items", "PATCH", { productId, variantId, quantity });
      setCart(updated);
      setStockNotices(updated.stockNotices);
    } finally {
      setBusyLine(null);
    }
  }

  async function removeLine(productId: number, variantId: number | undefined) {
    setBusyLine(lineId(productId, variantId));
    try {
      const updated = await mutateJson<CartResponse>("/cart/items", "DELETE", { productId, variantId });
      setCart(updated);
      setStockNotices(updated.stockNotices);
    } finally {
      setBusyLine(null);
    }
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponInput.trim() || couponLoading) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const updated = await mutateJson<CartResponse>("/cart/coupon", "POST", { code: couponInput.trim() });
      setCart(updated);
      setCouponInput("");
    } catch (err) {
      setCouponError(err instanceof ClientApiError ? err.message : "Kupon uygulanamadı");
    } finally {
      setCouponLoading(false);
    }
  }

  async function removeCoupon() {
    setCouponLoading(true);
    try {
      const updated = await mutateJson<CartResponse>("/cart/coupon", "DELETE");
      setCart(updated);
    } finally {
      setCouponLoading(false);
    }
  }

  const subtotal = pricedCart ? Number(pricedCart.subtotal) : 0;
  const discountAmount = pricedCart ? Number(pricedCart.discountAmount) : 0;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const multipleVendors = (pricedCart?.shippingBreakdown.length ?? 0) > 1;
  const total = pricedCart ? Number(pricedCart.total) : 0;

  const selectedItems = cart?.items.filter((i) => selected.has(lineId(i.productId, i.variantId))) ?? [];
  const selectedSubtotal = selectedItems.reduce((sum, i) => sum + Number(i.lineTotal), 0);
  const allSelected = cart !== null && cart.items.length > 0 && cart.items.every((i) => selected.has(lineId(i.productId, i.variantId)));
  const checkoutHref =
    selectedItems.length > 0 && cart && selectedItems.length < cart.items.length
      ? `/odeme?selected=${selectedItems.map((i) => lineId(i.productId, i.variantId)).join(",")}`
      : "/odeme";

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

          {/* bkz. kullanıcı isteği: "stok durumu sürekli kontrol ettirilmeli
              ... 14 tane şort etek var 30 tane alabiliyorum bu olmamalı" -
              backend sepeti gerçek stoğa göre otomatik düzelttiğinde
              (bkz. cart.service.ts hydrateCart) müşteri neden azaldığını
              sessizce merak etmesin diye açık bir uyarı gösterilir. */}
          {stockNotices.length > 0 && (
            <div className="cart-stock-notice" style={{ marginBottom: 16 }}>
              {stockNotices.map((n, i) => (
                <p key={i}>
                  <i className="fas fa-exclamation-triangle" /> <strong>{n.productName}{n.variantLabel ? ` (${n.variantLabel})` : ""}</strong>{" "}
                  için stok yetersiz, sepetinizdeki miktar {n.availableStock} adete güncellendi.
                </p>
              ))}
            </div>
          )}

          {cart === null ? (
            <p>Sepet yükleniyor...</p>
          ) : cart.items.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-shopping-bag" />
              <h2>Sepetiniz Henüz Boş</h2>
              <p>
                {siteStats && siteStats.activeProducts > 0
                  ? `Mağazamızda ${formatStatCount(siteStats.activeProducts)} yeni model ve indirimli ürün sizleri bekliyor.`
                  : "Mağazamızda sizi bekleyen yeni ürünler var."}
              </p>
              <Link href="/urunler" className="btn btn-primary btn-lg">
                Alışverişe Başla
              </Link>
            </div>
          ) : (
            <div className="cart-grid">
              <div className="cart-items">
                <label className="cart-select-all">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  <span>Tümünü Seç ({cart.items.length} ürün)</span>
                </label>
                {cart.items.map((item) => {
                  const id = lineId(item.productId, item.variantId);
                  const isBusy = busyLine === id;
                  return (
                    <div key={id} className="cart-item">
                      <input
                        type="checkbox"
                        className="cart-item-check"
                        checked={selected.has(id)}
                        onChange={() => toggleLine(id)}
                        aria-label="Bu ürünü seç"
                      />
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
                            disabled={isBusy || (item.availableStock !== undefined && item.quantity >= item.availableStock)}
                            onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        {item.availableStock !== undefined && item.availableStock <= 5 && (
                          <div className="cart-item-stock-hint">Stokta {item.availableStock} adet kaldı</div>
                        )}
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

                {!multipleVendors && (
                  <div className="free-shipping-bar">
                    <div className="free-shipping-progress" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="free-shipping-text">
                  {shippingFee === 0
                    ? "Ücretsiz kargo kazandınız!"
                    : multipleVendors
                      ? "Ücretsiz kargo eşiği her satıcı için ayrı hesaplanır; mağaza detayları aşağıdadır."
                      : remaining > 0
                    ? `Ücretsiz kargo için ${remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ daha ekleyin`
                    : "Ücretsiz kargo kazandınız!"}
                </div>

                {cart.couponCode ? (
                  <div className="coupon-applied">
                    <span>
                      <i className="fas fa-tag" /> Kupon: <strong>{cart.couponCode}</strong>
                    </span>
                    <button type="button" onClick={removeCoupon} disabled={couponLoading}>
                      Kaldır
                    </button>
                  </div>
                ) : (
                  <form className="coupon-form" onSubmit={applyCoupon}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Kupon kodu"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={couponLoading}>
                      Uygula
                    </button>
                  </form>
                )}
                {couponError && <p className="coupon-error">{couponError}</p>}

                <div className="summary-row">
                  <span>Ara Toplam</span>
                  <span>{subtotal.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>
                {discountAmount > 0 && (
                  <div className="summary-row coupon-discount-row">
                    <span>{pricedCart?.discountSource === "campaign" ? "Kampanya indirimi" : "Kupon indirimi"}</span>
                    <span>-{discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                  </div>
                )}
                <div className="summary-row">
                  <span>Kargo{pricedCart && pricedCart.shippingBreakdown.length > 1 ? ` (${pricedCart.shippingBreakdown.length} satıcı)` : ""}</span>
                  <span>{shippingFee === 0 ? "Ücretsiz" : `${shippingFee.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}</span>
                </div>
                {pricedCart && pricedCart.shippingBreakdown.length > 1 &&
                  pricedCart.shippingBreakdown.map((b, i) => (
                    <div
                      key={i}
                      className="summary-row"
                      style={{ fontSize: "0.8rem", color: "var(--color-text-light)", paddingLeft: 14, marginTop: -4 }}
                    >
                      <span>
                        <i className="fas fa-store" style={{ fontSize: 10, opacity: 0.6 }} /> {b.storeName}
                      </span>
                      <span>{b.free ? "Ücretsiz" : `${Number(b.fee).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}</span>
                    </div>
                  ))}
                <div className="summary-row total">
                  <span>Toplam</span>
                  <span>{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>

                {selectedItems.length > 0 && selectedItems.length < cart.items.length && (
                  <div className="summary-row cart-selected-note">
                    <span>Seçilenler ({selectedItems.length} ürün)</span>
                    <span>{formatMoney(selectedSubtotal)} ₺</span>
                  </div>
                )}

                {selectedItems.length === 0 ? (
                  <button type="button" className="btn btn-primary btn-block" disabled>
                    Ödeme İçin Ürün Seçin
                  </button>
                ) : (
                  <Link href={checkoutHref} className="btn btn-primary btn-block">
                    {selectedItems.length < cart.items.length
                      ? `Seçilenleri Öde (${selectedItems.length})`
                      : "Ödemeye Geç"}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
