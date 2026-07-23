"use client";

import { useEffect, useState } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminRefundRow } from "@/lib/types";

const STATUS_LABEL: Record<AdminRefundRow["status"], string> = {
  pending: "Satıcı Kararı Bekliyor",
  approved: "Onaylandı, Kargo Bekleniyor",
  rejected: "Reddedildi",
  item_received: "Ürün Teslim Alındı",
  refunded: "Para İade Edildi",
};

const STATUS_BADGE: Record<AdminRefundRow["status"], string> = {
  pending: "pending",
  approved: "active",
  rejected: "cancelled",
  item_received: "active",
  refunded: "active",
};

const FILTERS: { value: AdminRefundRow["status"] | ""; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Satıcı Kararı Bekliyor" },
  { value: "approved", label: "Kargo Bekleniyor" },
  { value: "item_received", label: "İade Bekliyor" },
  { value: "refunded", label: "Tamamlandı" },
  { value: "rejected", label: "Reddedilen" },
];

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

// bkz. kullanıcı isteği: "iadeyi onaylarsa satıcı ... ürün satıcıya teslim
// edildiğinden emin olduğumuzda müşteriye parasını iade edeceğiz" - admin
// artık onay/red kararı vermiyor (bu satıcının işi, bkz. satici panel), tek
// yetkisi satıcı "ürünü teslim aldım" dedikten sonra gerçek parasal iadeyi
// (iyzico) tetiklemek.
export default function RefundsManager() {
  const [data, setData] = useState<{ items: AdminRefundRow[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState<AdminRefundRow["status"] | "">("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = status ? `?status=${status}` : "";
    setData(await fetchJson(`/admin/refunds${params}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function release(id: number) {
    if (!confirm("Müşteriye gerçek para iadesi yapılacak. Onaylıyor musunuz?")) return;
    setBusyId(id);
    setError(null);
    try {
      await mutateJson(`/admin/refunds/${id}/release`, "POST");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "İade işlemi başarısız oldu");
    } finally {
      setBusyId(null);
    }
  }

  const total = data ? Object.values(data.counts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <div>
      <div className="admin-order-stats">
        <div className="admin-order-stat"><strong>{total}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Toplam İade</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-warning)" }}>{data?.counts.pending ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Satıcı Kararı Bekliyor</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-info)" }}>{data?.counts.item_received ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>İade Bekliyor (Sizde)</span></div>
        <div className="admin-order-stat"><strong style={{ color: "var(--admin-success)" }}>{data?.counts.refunded ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Tamamlanan</span></div>
      </div>

      {error && (
        <div className="admin-card">
          <div className="admin-card-body" style={{ color: "var(--admin-error)" }}>{error}</div>
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>İadeler</h2>
          <div className="quick-actions">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={status === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
                onClick={() => setStatus(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {data === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : data.items.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-undo" />
            <h3>Bu filtrede iade talebi yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Ürün</th>
                  <th>Satıcı</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Sebep / Fotoğraflar</th>
                  <th>İade Kargo Bilgisi</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.orderNumber}</td>
                    <td>{r.productNameSnapshot}</td>
                    <td style={{ fontSize: "0.85rem" }}>{r.vendorStoreName}</td>
                    <td style={{ fontSize: "0.85rem" }}>{r.customerName}</td>
                    <td style={{ fontWeight: 700, color: "var(--admin-error)" }}>{tl(r.total)}</td>
                    <td style={{ fontSize: "0.85rem", maxWidth: 220 }}>
                      {r.reason}
                      {r.photos.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                          {r.photos.map((p) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a key={p} href={p} target="_blank" rel="noreferrer">
                              <img src={p} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {r.returnTrackingNumber ? `${r.returnTrackingCarrier} — ${r.returnTrackingNumber}` : "—"}
                      {r.receivedByVendorAt && <div style={{ color: "var(--admin-success)" }}>Satıcı teslim aldı</div>}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.status === "item_received" && (
                        <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === r.id} onClick={() => release(r.id)}>
                          {busyId === r.id ? "İşleniyor..." : "Parayı İade Et"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
