"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminOrderDetail, AdminOrderRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
  refunded: "İade Edildi",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "inactive",
};

// admin-orders.repository.ts'deki ALLOWED_TRANSITIONS ile birebir aynı -
// sunucu zaten geçersiz geçişi reddediyor, burada sadece kullanıcıya
// anlamsız seçenek sunulmasın diye tekrarlanıyor.
const NEXT_STATUS: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const FILTERS = ["Tümü", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;

function StatusChanger({ orderId, status, onChanged }: { orderId: number; status: string; onChanged: (status: string) => void }) {
  const [busy, setBusy] = useState(false);
  const options = NEXT_STATUS[status] ?? [];
  if (options.length === 0) return null;

  async function apply(next: string) {
    if (next === "cancelled" && !confirm("Bu siparişi iptal etmek istediğinize emin misiniz? Stok otomatik olarak geri yüklenecek.")) return;
    setBusy(true);
    try {
      await mutateJson<AdminOrderDetail>(`/admin/orders/${orderId}`, "PATCH", { status: next });
      onChanged(next);
    } catch {
      alert("Durum güncellenemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value=""
      disabled={busy}
      onChange={(e) => e.target.value && apply(e.target.value)}
      className="admin-form-control"
      style={{ fontSize: "0.8rem", padding: "4px 8px", width: "auto" }}
    >
      <option value="">Durumu değiştir…</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {STATUS_LABEL[opt] ?? opt}
        </option>
      ))}
    </select>
  );
}

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
    const counts: Record<string, number> = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 };
    for (const o of orders ?? []) counts[o.status] = (counts[o.status] ?? 0) + 1;
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

  function handleRowStatusChange(id: number, next: string) {
    setOrders((prev) => prev?.map((o) => (o.id === id ? { ...o, status: next } : o)) ?? null);
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status: next } : prev));
  }

  return (
    <div className="admin-form-row">
      <div className="stats-grid stats-grid-5">
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Beklemede</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.processing}</div>
          <div className="stat-label">Hazırlanıyor</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.shipped}</div>
          <div className="stat-label">Kargoda</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.delivered}</div>
          <div className="stat-label">Teslim Edildi</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.cancelled}</div>
          <div className="stat-label">İptal</div>
        </div>
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
                  <th></th>
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
                    <td>
                      <StatusChanger orderId={o.id} status={o.status} onChanged={(next) => handleRowStatusChange(o.id, next)} />
                    </td>
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
            <StatusChanger orderId={selected.id} status={selected.status} onChanged={(next) => handleRowStatusChange(selected.id, next)} />
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
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productNameSnapshot}</td>
                      <td style={{ fontSize: "0.85rem" }}>{item.vendorStoreName}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                      <td>{STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}</td>
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
