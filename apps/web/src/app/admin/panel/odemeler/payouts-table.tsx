"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminFinanceOverview, AdminPayoutRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { pending: "Beklemede", paid: "Ödendi", rejected: "Reddedildi" };
const STATUS_CLASS: Record<string, string> = { pending: "pending", paid: "delivered", rejected: "cancelled" };

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function PayoutsTable() {
  const [payouts, setPayouts] = useState<AdminPayoutRow[] | null>(null);
  const [processed, setProcessed] = useState<AdminPayoutRow[] | null>(null);
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setPayouts(await fetchJson<AdminPayoutRow[]>("/admin/payouts?status=pending"));
  }

  useEffect(() => {
    load();
    fetchJson<AdminPayoutRow[]>("/admin/payouts/processed").then(setProcessed);
    fetchJson<AdminFinanceOverview>("/admin/finance-overview").then(setOverview);
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

  return (
    <div className="admin-form-row">
      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{tl(overview.stats.platformGrossRevenue)}</div>
            <div className="stat-label">Platform Cirosu</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{tl(overview.stats.pendingPayoutTotal)}</div>
            <div className="stat-label">Bekleyen Ödeme Toplamı</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{tl(overview.stats.paidPayoutTotal)}</div>
            <div className="stat-label">Toplam Ödenen</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{tl(overview.stats.vendorBalanceTotal)}</div>
            <div className="stat-label">Satıcı Bakiyeleri Toplamı</div>
          </div>
        </div>
      )}

      <div className="admin-card">
      <div className="admin-card-header">
        <h2>Ödeme Talepleri</h2>
      </div>
      {payouts === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : payouts.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-wallet" />
          <h3>Bekleyen ödeme talebi yok</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
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
                  <td style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>{p.note || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === p.id} onClick={() => approve(p.id)}>
                        Onayla
                      </button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" disabled={busyId === p.id} onClick={() => reject(p.id)}>
                        Reddet
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

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Satıcı Bazında Ciro &amp; Kazanç</h2>
        </div>
        {overview === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : overview.vendorSummaries.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-chart-line" />
            <h3>Henüz veri yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Satıcı</th>
                  <th>Ürün</th>
                  <th>Ciro</th>
                  <th>Net Kazanç</th>
                  <th>Ödenen</th>
                  <th>Bakiye</th>
                  <th>IBAN</th>
                </tr>
              </thead>
              <tbody>
                {overview.vendorSummaries.map((v) => (
                  <tr key={v.id}>
                    <td>{v.storeName}</td>
                    <td>{v.productCount}</td>
                    <td>{tl(v.grossRevenue)}</td>
                    <td>{tl(v.netEarnings)}</td>
                    <td>{tl(v.totalPaid)}</td>
                    <td>{tl(v.walletBalance)}</td>
                    <td
                      style={{ fontFamily: "monospace", fontSize: "0.75rem", cursor: v.bankIban ? "pointer" : undefined }}
                      title={v.bankIban ? "Kopyalamak için tıkla" : undefined}
                      onClick={() => v.bankIban && navigator.clipboard.writeText(v.bankIban)}
                    >
                      {v.bankIban ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Ödeme Geçmişi</h2>
        </div>
        {processed === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : processed.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-history" />
            <h3>Henüz işlenmiş ödeme yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Satıcı</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>İşlem Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((p) => (
                  <tr key={p.id}>
                    <td>{p.vendorStoreName}</td>
                    <td>{tl(p.amount)}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${STATUS_CLASS[p.status] ?? "pending"}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{p.processedAt ? new Date(p.processedAt).toLocaleDateString("tr-TR") : "—"}</td>
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
