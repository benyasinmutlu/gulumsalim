"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { AdminOrderDetail, AdminOrderRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
  refunded: "İade Edildi",
};

// order_items.vendorStatus "pending"i sipariş genelindeki "pending"den farklı
// anlama gelir (bkz. hesabim/siparisler/[orderNumber]/page.tsx ITEM_STATUS_LABEL
// yorumu) - aynı Türkçe karşılık ("Beklemede") burada zaten uygun olduğundan
// metin aynı ama kavramsal olarak ayrı tutulduğu belirtiliyor.
const ITEM_STATUS_LABEL = STATUS_LABEL;

const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "inactive",
};

const FILTERS = ["Tümü", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;

// bkz. kullanıcı isteği: "ürünü hazırlama kargolama iptal ve iade işlemleri
// satıcıda olmalı" - bu sayfa artık SALT OKUNUR bir genel bakış. Admin
// burada durum değiştiremez (önceki denetimde tespit edilen mantık hatası:
// admin panel satıcının işini tekrarlıyordu) - genel durum satıcıların
// kendi kalem durumlarından otomatik hesaplanır (bkz. order.repository.ts
// recomputeOrderStatus). İade/para akışı ayrı bir sayfada (bkz.
// admin/panel/iadeler).
export default function OrdersTable() {
  const [orders, setOrders] = useState<AdminOrderRow[] | null>(null);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tümü");

  async function load() {
    setOrders(await fetchJson<AdminOrderRow[]>("/admin/orders"));
  }

  useEffect(() => {
    load();
  }, []);

  async function openDetail(id: number) {
    setSelected(await fetchJson<AdminOrderDetail>(`/admin/orders/${id}`));
  }

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0, total: 0 };
    for (const o of orders ?? []) counts[o.status] = (counts[o.status] ?? 0) + 1;
    counts.total = orders?.length ?? 0;
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return null;
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "Tümü" && o.status !== filter) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerEmail.toLowerCase().includes(q);
    });
  }, [orders, search, filter]);

  return (
    <div className="admin-form-row">
      <div className="admin-order-stats">
        <div className="admin-order-stat"><strong>{stats.total}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Toplam</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-warning)" }}>{stats.pending}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Bekleyen</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-info)" }}>{stats.processing}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Hazırlanan</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-purple)" }}>{stats.shipped}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Kargoda</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-success)" }}>{stats.delivered}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Teslim</span></div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Siparişler</h2>
        </div>
        <div className="admin-card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingBottom: 0 }}>
          <input
            className="admin-form-control"
            style={{ maxWidth: 280 }}
            placeholder="Sipariş no, müşteri adı veya e-posta ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="quick-actions">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`admin-btn ${filter === f ? "admin-btn-primary" : "admin-btn-secondary"}`}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === "Tümü" ? "Tümü" : (STATUS_LABEL[f] ?? f)}
              </button>
            ))}
          </div>
        </div>

        {orders === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : filtered && filtered.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-shopping-bag" />
            <h3>Sipariş bulunamadı</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); openDetail(o.id); }}>
                        {o.orderNumber}
                      </a>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>
                      {o.customerName}
                      <br />
                      <span style={{ color: "var(--admin-text-muted)" }}>{o.customerEmail}</span>
                    </td>
                    <td>{Number(o.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                    <td>
                      <span className={`admin-badge admin-badge-${STATUS_CLASS[o.status] ?? "pending"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{new Date(o.createdAt).toLocaleDateString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Sipariş #{selected.orderNumber}</h2>
            <span className={`admin-badge admin-badge-${STATUS_CLASS[selected.status] ?? "pending"}`}>{STATUS_LABEL[selected.status] ?? selected.status}</span>
          </div>
          <div className="admin-card-body">
            <p style={{ marginBottom: 8 }}>
              <strong>Müşteri:</strong> {selected.customerName} ({selected.customerEmail})
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Ödeme:</strong> {selected.paymentProvider} — {selected.paymentStatus}
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Teslimat Adresi:</strong>{" "}
              {(() => {
                const addr = selected.shippingAddress as Record<string, unknown>;
                return [addr?.fullName, addr?.addressLine, addr?.district, addr?.city, addr?.phone]
                  .filter((v): v is string => typeof v === "string" && v.length > 0)
                  .join(", ");
              })()}
            </p>
            {selected.orderNote && (
              <p style={{ marginBottom: 8 }}>
                <strong>Müşteri Notu:</strong> {selected.orderNote}
              </p>
            )}
            <p style={{ marginBottom: 16 }}>
              <strong>Toplam:</strong> {Number(selected.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Satıcı</th>
                    <th>Adet</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                    <th>Kargo</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productNameSnapshot}</td>
                      <td style={{ fontSize: "0.85rem" }}>{item.vendorStoreName}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                      <td>{ITEM_STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}</td>
                      <td style={{ fontSize: "0.8rem" }}>{item.trackingNumber ? `${item.trackingCarrier} — ${item.trackingNumber}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
