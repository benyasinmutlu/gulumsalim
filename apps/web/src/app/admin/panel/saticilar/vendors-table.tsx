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

export default function VendorsTable() {
  const [data, setData] = useState<AdminVendorsResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(status: string) {
    const qs = status ? `?status=${status}` : "";
    setData(await fetchJson<AdminVendorsResponse>(`/admin/vendors${qs}`));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function applyAction(id: number, action: string) {
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendors/${id}`, "PATCH", { action });
      await load(filter);
    } finally {
      setBusyId(null);
    }
  }

  async function removeVendor(id: number, storeName: string) {
    if (!confirm(`"${storeName}" başvurusu/hesabı kalıcı olarak silinsin mi?`)) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendors/${id}`, "DELETE");
      await load(filter);
    } finally {
      setBusyId(null);
    }
  }

  return (
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
                <th>Yetkili / E-posta</th>
                <th>Ürün</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.storeName}</td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {v.fullName}
                    <br />
                    <span style={{ color: "var(--admin-text-muted)" }}>{v.email}</span>
                  </td>
                  <td>{v.productCount}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${v.status}`}>{STATUS_LABEL[v.status]}</span>
                  </td>
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
  );
}
