"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminRefundRow } from "@/lib/types";

const STATUS_LABEL: Record<AdminRefundRow["status"], string> = {
  pending: "Beklemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export default function RefundsManager() {
  const [refunds, setRefunds] = useState<AdminRefundRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setRefunds(await fetchJson<AdminRefundRow[]>("/admin/refunds"));
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await mutateJson(`/admin/refunds/${id}`, "PATCH", { action });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>İade Talepleri</h2>
      </div>
      {refunds === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : refunds.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-undo" />
          <h3>İade talebi yok</h3>
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
                <th>Sebep</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td>{r.orderNumber}</td>
                  <td>{r.productNameSnapshot}</td>
                  <td style={{ fontSize: "0.85rem" }}>{r.vendorStoreName}</td>
                  <td style={{ fontSize: "0.85rem" }}>{r.customerName}</td>
                  <td style={{ fontSize: "0.85rem", maxWidth: 220 }}>{r.reason}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${r.status === "approved" ? "active" : r.status === "rejected" ? "cancelled" : "pending"}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {r.status === "pending" && (
                      <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                        <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>
                          Onayla
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>
                          Reddet
                        </button>
                      </div>
                    )}
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
