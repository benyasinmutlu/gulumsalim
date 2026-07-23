"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminProductRow } from "@/lib/types";

const STATUS_LABEL: Record<AdminProductRow["status"], string> = {
  draft: "Taslak",
  active: "Aktif",
  inactive: "Pasif",
  rejected: "Reddedildi",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "draft", label: "Taslak" },
  { value: "inactive", label: "Pasif" },
  { value: "rejected", label: "Reddedildi" },
];

export default function ProductsManager() {
  const [data, setData] = useState<{ items: AdminProductRow[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    setData(await fetchJson(`/admin/products?${params.toString()}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function updateStatus(id: number, next: AdminProductRow["status"]) {
    setBusyId(id);
    try {
      await mutateJson(`/admin/products/${id}`, "PATCH", { status: next });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`"${name}" kalıcı olarak silinsin mi?`)) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/products/${id}`, "DELETE");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Ürünler</h2>
        <div className="quick-actions">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={status === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
              onClick={() => setStatus(f.value)}
            >
              {f.label} {f.value && data?.counts[f.value] ? `(${data.counts[f.value]})` : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-card-body" style={{ paddingBottom: 0 }}>
        <input
          className="admin-form-control"
          placeholder="Ürün ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>

      {data === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : data.items.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-tshirt" />
          <h3>Bu filtrede ürün yok</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Satıcı</th>
                <th>Kategori</th>
                <th>Fiyat</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.vendorStoreName}</td>
                  <td style={{ fontSize: "0.85rem" }}>{p.categoryName}</td>
                  <td>{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                  <td>
                    <span className={`admin-badge admin-badge-${p.status}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      {p.status === "active" ? (
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" disabled={busyId === p.id} onClick={() => updateStatus(p.id, "inactive")}>
                          Pasife Al
                        </button>
                      ) : (
                        <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === p.id} onClick={() => updateStatus(p.id, "active")}>
                          Aktif Et
                        </button>
                      )}
                      <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busyId === p.id} onClick={() => handleDelete(p.id, p.name)}>
                        Sil
                      </button>
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
