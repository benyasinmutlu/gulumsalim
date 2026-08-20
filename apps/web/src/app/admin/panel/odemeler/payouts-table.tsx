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
  const [transferRefs, setTransferRefs] = useState<Record<number, string>>({});

  async function load() {
    setPayouts(await fetchJson<AdminPayoutRow[]>("/admin/payouts?status=pending"));
  }

  useEffect(() => {
    load();
    fetchJson<AdminPayoutRow[]>("/admin/payouts/processed").then(setProcessed);
    fetchJson<AdminFinanceOverview>("/admin/finance-overview").then(setOverview);
  }, []);

  async function approve(id: number) {
    const transferReference = transferRefs[id]?.trim();
    if (!transferReference) return;
    if (!window.confirm("Banka transferini gerçekten yaptığınızı ve referansın doğru olduğunu onaylıyor musunuz?")) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/payouts/${id}`, "PATCH", { action: "approve", transferReference });
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
        <div className="admin-fin-stats">
          <div className="admin-fin-stat">
            <div className="admin-fin-stat-icon" style={{ background: "var(--admin-primary-light)", color: "var(--admin-primary)" }}><i className="fas fa-coins" /></div>
            <div className="admin-fin-stat-body">
              <div className="lbl">Platform Cirosu</div>
              <div className="val">{tl(overview.stats.platformGrossRevenue)}</div>
              <div className="sub">Tüm satıcılar</div>
            </div>
          </div>
          <div className="admin-fin-stat">
            <div className="admin-fin-stat-icon" style={{ background: "rgba(255,170,0,.1)", color: "var(--admin-warning)" }}><i className="fas fa-clock" /></div>
            <div className="admin-fin-stat-body">
              <div className="lbl">Bekleyen Ödeme</div>
              <div className="val" style={{ color: "var(--admin-warning)" }}>{tl(overview.stats.pendingPayoutTotal)}</div>
              <div className="sub">{payouts?.length ?? 0} talep</div>
            </div>
          </div>
          <div className="admin-fin-stat">
            <div className="admin-fin-stat-icon" style={{ background: "rgba(0,214,143,.1)", color: "var(--admin-success)" }}><i className="fas fa-check-double" /></div>
            <div className="admin-fin-stat-body">
              <div className="lbl">Toplam Ödenen</div>
              <div className="val" style={{ color: "var(--admin-success)" }}>{tl(overview.stats.paidPayoutTotal)}</div>
            </div>
          </div>
          <div className="admin-fin-stat">
            <div className="admin-fin-stat-icon" style={{ background: "var(--admin-accent-light)", color: "var(--admin-accent)" }}><i className="fas fa-wallet" /></div>
            <div className="admin-fin-stat-body">
              <div className="lbl">Satıcı Bakiyeleri</div>
              <div className="val">{tl(overview.stats.vendorBalanceTotal)}</div>
              <div className="sub">Henüz talep edilmemiş</div>
            </div>
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
                <th>Hesap Sahibi</th>
                <th>Not</th>
                <th>Transfer Referansı</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>{p.vendorStoreName}</td>
                  <td>{tl(p.amount)}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.iban}</td>
                  <td>{p.accountHolder || "—"}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>{p.note || "—"}</td>
                  <td>
                    <input
                      className="admin-form-control"
                      value={transferRefs[p.id] ?? ""}
                      onChange={(event) => setTransferRefs((current) => ({ ...current, [p.id]: event.target.value }))}
                      placeholder="Dekont / banka işlem no"
                      maxLength={120}
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                      <button className="admin-btn admin-btn-success admin-btn-sm" disabled={busyId === p.id || !transferRefs[p.id]?.trim()} onClick={() => approve(p.id)}>
                        Transfer Yapıldı
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
                  <th>Puan</th>
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
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, var(--admin-primary), var(--admin-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
                          {v.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            v.storeName.charAt(0).toUpperCase()
                          )}
                        </div>
                        {v.storeName}
                      </div>
                    </td>
                    <td>
                      {v.productCount}
                      {v.lowStockCount > 0 && (
                        <span className="admin-badge admin-badge-draft" style={{ marginLeft: 6 }} title="Düşük stoklu ürün">
                          {v.lowStockCount} düşük stok
                        </span>
                      )}
                    </td>
                    <td>{v.avgRating ? `★ ${Number(v.avgRating).toFixed(1)}` : "—"}</td>
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
                  <th>Transfer Referansı</th>
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
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.transferReference || "—"}</td>
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
