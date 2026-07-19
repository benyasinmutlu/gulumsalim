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

  if (data === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={filter === f.value ? "btn" : "btn btn-secondary"}
            style={{ fontSize: "0.8rem" }}
            onClick={() => setFilter(f.value)}
          >
            {f.label} {f.value && data.counts[f.value] ? `(${data.counts[f.value]})` : ""}
          </button>
        ))}
      </div>

      {data.vendors.length === 0 ? (
        <p className="empty-state">Bu filtrede satıcı yok.</p>
      ) : (
        <table className="data-table">
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
                  <span style={{ opacity: 0.65 }}>{v.email}</span>
                </td>
                <td>{v.productCount}</td>
                <td>
                  <span className="badge">{STATUS_LABEL[v.status]}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {v.status === "pending" && (
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === v.id} onClick={() => applyAction(v.id, "approve")}>
                        Onayla
                      </button>
                    )}
                    {v.status === "active" && (
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === v.id} onClick={() => applyAction(v.id, "suspend")}>
                        Askıya Al
                      </button>
                    )}
                    {(v.status === "suspended" || v.status === "pending") && (
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === v.id} onClick={() => applyAction(v.id, "activate")}>
                        Aktif Et
                      </button>
                    )}
                    {v.status !== "banned" && (
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === v.id} onClick={() => applyAction(v.id, "ban")}>
                        Yasakla
                      </button>
                    )}
                    {Number(v.productCount) === 0 && (
                      <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === v.id} onClick={() => removeVendor(v.id, v.storeName)}>
                        Sil
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
