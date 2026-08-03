"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminVendorRow, AdminVendorsResponse } from "@/lib/types";

const STATUS_LABEL: Record<AdminVendorRow["status"], string> = {
  pending: "Onay Bekliyor",
  active: "Aktif",
  suspended: "Askıda",
  banned: "Yasaklı",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Onay Bekleyen" },
  { value: "active", label: "Aktif" },
  { value: "suspended", label: "Askıda" },
  { value: "banned", label: "Yasaklı" },
];

// bkz. kullanıcı isteği (2026-08-02): "bireysel satıcıları admin panelinden
// ayrı yönetelim" - iki ayrı sayfa/route yerine (durum filtresiyle aynı
// desende) bir tür filtresi eklendi, admin istediğinde sadece bireysel
// satıcıları görebiliyor.
const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "business", label: "Kurumsal" },
  { value: "individual", label: "Bireysel" },
];

const TYPE_LABEL: Record<AdminVendorRow["vendorType"], string> = {
  business: "Kurumsal",
  individual: "Bireysel",
};

const DEFAULT_COMMISSION_RATE = 5;

export default function VendorsTable() {
  const [data, setData] = useState<AdminVendorsResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingCommissionId, setEditingCommissionId] = useState<number | null>(null);
  const [commissionDraft, setCommissionDraft] = useState("");

  async function load(status: string, vendorType: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (vendorType) params.set("vendorType", vendorType);
    const qs = params.toString();
    setData(await fetchJson<AdminVendorsResponse>(`/admin/vendors${qs ? `?${qs}` : ""}`));
  }

  useEffect(() => {
    load(filter, typeFilter);
  }, [filter, typeFilter]);

  async function applyAction(id: number, action: string) {
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendors/${id}`, "PATCH", { action });
      await load(filter, typeFilter);
    } finally {
      setBusyId(null);
    }
  }

  async function removeVendor(id: number, storeName: string) {
    if (!confirm(`"${storeName}" başvurusu/hesabı kalıcı olarak silinsin mi?`)) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendors/${id}`, "DELETE");
      await load(filter, typeFilter);
    } finally {
      setBusyId(null);
    }
  }

  function startEditCommission(v: AdminVendorRow) {
    setEditingCommissionId(v.id);
    setCommissionDraft(v.commissionRate ?? String(DEFAULT_COMMISSION_RATE));
  }

  // bkz. kullanıcı isteği: "her satıcıya admin üzerinden farklı komisyon
  // oranları belirlenebilecek" - boş bırakılıp kaydedilirse platform
  // varsayılanına döner (null gönderilir).
  async function saveCommission(id: number) {
    const trimmed = commissionDraft.trim();
    const rate = trimmed === "" ? null : Number(trimmed);
    if (rate !== null && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      alert("Komisyon oranı 0-100 arasında bir sayı olmalı");
      return;
    }
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendors/${id}/commission`, "PATCH", { commissionRate: rate });
      setEditingCommissionId(null);
      await load(filter, typeFilter);
    } finally {
      setBusyId(null);
    }
  }

  const total = data ? Object.values(data.counts).reduce((sum, n) => sum + n, 0) : 0;

  return (
    <div>
      <div className="admin-order-stats">
        <a href="#" onClick={(e) => { e.preventDefault(); setFilter(""); }} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="admin-order-stat"><strong>{total}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Toplam</span></div>
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); setFilter("pending"); }} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="admin-order-stat"><strong style={{ color: "var(--admin-warning)" }}>{data?.counts.pending ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Onay Bekleyen</span></div>
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); setFilter("active"); }} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="admin-order-stat"><strong style={{ color: "var(--admin-success)" }}>{data?.counts.active ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Aktif</span></div>
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); setFilter("suspended"); }} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="admin-order-stat"><strong style={{ color: "var(--admin-error)" }}>{data?.counts.suspended ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Askıda</span></div>
        </a>
        <a href="#" onClick={(e) => { e.preventDefault(); setTypeFilter("individual"); }} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="admin-order-stat"><strong>{data?.typeCounts.individual ?? 0}</strong> <span style={{ color: "var(--admin-text-muted)" }}>Bireysel Satıcı</span></div>
        </a>
      </div>

      <div className="admin-card">
      <div className="admin-card-header">
        <h2>Satıcılar</h2>
        <div className="quick-actions">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
              onClick={() => setFilter(f.value)}
            >
              {f.label} {f.value && data?.counts[f.value] ? `(${data.counts[f.value]})` : ""}
            </button>
          ))}
        </div>
      </div>
      {/* bkz. kullanıcı isteği: "bireysel satıcıları admin panelinden ayrı
          yönetelim" - durum filtresinden bağımsız, ikinci bir tür filtresi. */}
      <div className="admin-card-body" style={{ paddingTop: 0, paddingBottom: 0, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>Tür:</span>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            className={typeFilter === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
            onClick={() => setTypeFilter(f.value)}
          >
            {f.label} {f.value && data?.typeCounts[f.value] ? `(${data.typeCounts[f.value]})` : ""}
          </button>
        ))}
      </div>

      {data === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : data.vendors.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-store" />
          <h3>Bu filtrede satıcı yok</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mağaza</th>
                <th>Tür</th>
                <th>Yetkili / İletişim</th>
                <th>Ürün</th>
                <th>Komisyon</th>
                <th>Durum</th>
                <th>Kayıt</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {v.storeName}
                      {v.isVerified && <i className="fas fa-badge-check" style={{ color: "#3897f0", marginLeft: 4 }} title="Onaylı" />}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>/{v.storeSlug}</div>
                  </td>
                  <td>
                    <span className={`admin-badge ${v.vendorType === "individual" ? "admin-badge-draft" : "admin-badge-active"}`}>
                      {TYPE_LABEL[v.vendorType]}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    <div>{v.fullName}</div>
                    <div style={{ color: "var(--admin-text-muted)" }}>
                      {v.email}
                      {v.phone && ` · ${v.phone}`}
                    </div>
                  </td>
                  <td>
                    {v.productCount}
                    {Number(v.pendingProductCount) > 0 && (
                      <div style={{ fontSize: "0.72rem", color: "var(--admin-warning)", fontWeight: 600 }}>
                        {v.pendingProductCount} onay bekliyor
                      </div>
                    )}
                  </td>
                  <td>
                    {editingCommissionId === v.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          className="admin-form-control"
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          style={{ width: 70, fontSize: "0.8rem", padding: "4px 6px" }}
                          value={commissionDraft}
                          onChange={(e) => setCommissionDraft(e.target.value)}
                          placeholder={String(DEFAULT_COMMISSION_RATE)}
                        />
                        <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === v.id} onClick={() => saveCommission(v.id)}>
                          <i className="fas fa-check" />
                        </button>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setEditingCommissionId(null)}>
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    ) : (
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startEditCommission(v); }}
                        title="Komisyon oranını değiştir"
                      >
                        %{v.commissionRate ?? DEFAULT_COMMISSION_RATE}
                        {!v.commissionRate && <span style={{ color: "var(--admin-text-muted)" }}> (varsayılan)</span>}
                      </a>
                    )}
                  </td>
                  <td>
                    <span className={`admin-badge admin-badge-${v.status}`}>{STATUS_LABEL[v.status]}</span>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>{new Date(v.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {v.status === "pending" && (
                        <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === v.id} onClick={() => applyAction(v.id, "approve")}>
                          Onayla
                        </button>
                      )}
                      {v.status === "active" && (
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busyId === v.id} onClick={() => applyAction(v.id, "suspend")}>
                          Askıya Al
                        </button>
                      )}
                      {(v.status === "suspended" || v.status === "pending") && (
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busyId === v.id} onClick={() => applyAction(v.id, "activate")}>
                          Aktif Et
                        </button>
                      )}
                      {v.status !== "banned" && (
                        <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busyId === v.id} onClick={() => applyAction(v.id, "ban")}>
                          Yasakla
                        </button>
                      )}
                      <a href={`/${v.storeSlug}`} target="_blank" rel="noreferrer" className="admin-btn admin-btn-secondary admin-btn-sm" title="Mağazayı Gör">
                        <i className="fas fa-external-link-alt" />
                      </a>
                      {Number(v.productCount) === 0 && (
                        <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busyId === v.id} onClick={() => removeVendor(v.id, v.storeName)}>
                          Sil
                        </button>
                      )}
                    </div>
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
