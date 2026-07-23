"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { AdminCustomerRow } from "@/lib/types";

export default function CustomersTable() {
  const [customers, setCustomers] = useState<AdminCustomerRow[] | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    setCustomers(await fetchJson<AdminCustomerRow[]>(`/admin/customers?${params.toString()}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Müşteriler</h2>
      </div>
      <div className="admin-card-body" style={{ paddingBottom: 0 }}>
        <input
          className="admin-form-control"
          placeholder="Ad veya e-posta ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>
      {customers === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : customers.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-users" />
          <h3>Müşteri bulunamadı</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>E-posta</th>
                <th>Telefon</th>
                <th>Şehir/İlçe</th>
                <th>Sipariş</th>
                <th>Toplam Harcama</th>
                <th>Kayıt Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.fullName}
                    {c.isGuest && <span className="admin-badge admin-badge-draft" style={{ marginLeft: 6 }}>Misafir</span>}
                  </td>
                  <td>{c.email}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td style={{ fontSize: "0.85rem" }}>{c.city ? `${c.city}${c.district ? " / " + c.district : ""}` : "—"}</td>
                  <td>{c.orderCount}</td>
                  <td>{Number(c.totalSpent).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                    {new Date(c.createdAt).toLocaleDateString("tr-TR")}
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
