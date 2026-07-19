"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminPayoutRow } from "@/lib/types";

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function PayoutsTable() {
  const [payouts, setPayouts] = useState<AdminPayoutRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setPayouts(await fetchJson<AdminPayoutRow[]>("/admin/payouts?status=pending"));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    setBusyId(id);
    try {
      await mutateJson(`/admin/payouts/${id}`, "PATCH", { action: "approve" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    const reason = prompt("Red gerekçesi (opsiyonel):") ?? undefined;
    setBusyId(id);
    try {
      await mutateJson(`/admin/payouts/${id}`, "PATCH", { action: "reject", reason });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (payouts === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;
  if (payouts.length === 0) return <p className="empty-state">Bekleyen ödeme talebi yok.</p>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Satıcı</th>
          <th>Tutar</th>
          <th>IBAN</th>
          <th>Not</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {payouts.map((p) => (
          <tr key={p.id}>
            <td>{p.vendorStoreName}</td>
            <td>{tl(p.amount)}</td>
            <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.iban}</td>
            <td style={{ fontSize: "0.85rem", opacity: 0.75 }}>{p.note || "—"}</td>
            <td style={{ textAlign: "right" }}>
              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === p.id} onClick={() => approve(p.id)}>
                  Onayla
                </button>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} disabled={busyId === p.id} onClick={() => reject(p.id)}>
                  Reddet
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
