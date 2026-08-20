"use client";

import { useState } from "react";
import { ClientApiError, fetchJson } from "@/lib/client-api";
import type { CustomerOrderDetail } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Ödeme Bekleniyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "Hazırlanmayı Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

export default function OrderTrackingForm() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNumber.trim() || !email.trim() || loading) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const result = await fetchJson<CustomerOrderDetail>(
        `/orders/${encodeURIComponent(orderNumber.trim())}?email=${encodeURIComponent(email.trim())}`,
      );
      setOrder(result);
    } catch (err) {
      setError(err instanceof ClientApiError && err.status === 404 ? "Bu sipariş numarasıyla bir sipariş bulunamadı." : "Sipariş sorgulanırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <input
          type="text"
          className="form-control"
          placeholder="Sipariş Numaranız (ör. GS1234567890)"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
        />
        <input
          type="email"
          className="form-control"
          placeholder="Siparişte kullandığınız e-posta"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Aranıyor..." : "Sorgula"}
        </button>
      </form>

      {error && <p style={{ color: "var(--color-error)" }}>{error}</p>}

      {order && (
        <div className="form-card">
          <h3>Sipariş #{order.orderNumber}</h3>
          <p style={{ margin: "8px 0" }}>
            <span className={`status-badge status-${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
          </p>
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Satıcı</th>
                  <th>Adet</th>
                  <th>Durum</th>
                  <th>Kargo</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productNameSnapshot}</td>
                    <td style={{ fontSize: "0.85rem" }}>{item.vendorStoreName}</td>
                    <td>{item.quantity}</td>
                    <td>{ITEM_STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}</td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {item.trackingNumber ? `${item.trackingCarrier} — ${item.trackingNumber}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
