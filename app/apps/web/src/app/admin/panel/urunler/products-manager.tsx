"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminCategory, AdminProductRow } from "@/lib/types";

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

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function ProductsManager() {
  const [data, setData] = useState<{ items: AdminProductRow[]; counts: Record<string, number> } | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    if (categoryId) params.set("categoryId", categoryId);
    if (stock) params.set("stock", stock);
    setData(await fetchJson(`/admin/products?${params.toString()}`));
  }

  useEffect(() => {
    fetchJson<AdminCategory[]>("/admin/categories").then(setCategories);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, categoryId, stock]);

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
      <div className="admin-card-body" style={{ paddingBottom: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          className="admin-form-control"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Ürün ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
        <select className="admin-form-control" style={{ width: 180 }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tüm Kategoriler</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="admin-form-control" style={{ width: 160 }} value={stock} onChange={(e) => setStock(e.target.value)}>
          <option value="">Tüm Stok</option>
          <option value="low">Düşük Stok</option>
          <option value="out">Tükenmiş</option>
        </select>
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
                <th style={{ width: 50 }}></th>
                <th>Ürün</th>
                <th>Satıcı</th>
                <th>Kategori</th>
                <th>Fiyat</th>
                <th>Stok</th>
                <th style={{ textAlign: "center" }}>İlgi</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--admin-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="fas fa-image" style={{ color: "var(--admin-text-muted)", fontSize: 12 }} />
                      </div>
                    )}
                  </td>
                  <td>{p.name}</td>
                  <td>
                    <a href={`/${p.vendorSlug}`} target="_blank" rel="noreferrer" style={{ color: "var(--admin-primary)", fontWeight: 600, fontSize: 12 }}>
                      {p.vendorStoreName}
                    </a>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{p.categoryName}</td>
                  <td>
                    {p.compareAtPrice && Number(p.compareAtPrice) > Number(p.basePrice) ? (
                      <>
                        <div style={{ fontWeight: 700, color: "var(--admin-primary)" }}>{tl(p.basePrice)}</div>
                        <div style={{ fontSize: 11, color: "var(--admin-text-muted)", textDecoration: "line-through" }}>{tl(p.compareAtPrice)}</div>
                      </>
                    ) : (
                      tl(p.basePrice)
                    )}
                  </td>
                  <td>
                    {p.totalStock === 0 ? (
                      <span className="admin-badge admin-badge-rejected">Tükendi</span>
                    ) : p.totalStock < 5 ? (
                      <span className="admin-badge admin-badge-draft">{p.totalStock} adet</span>
                    ) : (
                      <span className="admin-badge admin-badge-active">{p.totalStock} adet</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", fontSize: 11, color: "var(--admin-text-secondary)" }}>
                      <span title="Görüntülenme"><i className="fas fa-eye" style={{ color: "var(--admin-info)" }} /> {p.viewCount}</span>
                      <span title="Favorilenme"><i className="fas fa-heart" style={{ color: "var(--admin-error)" }} /> {p.favoriteCount}</span>
                    </div>
                  </td>
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
