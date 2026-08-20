"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorEarning, VendorFinanceRefund, VendorPayout, VendorWallet } from "@/lib/types";

const STATUS_LABEL: Record<VendorPayout["status"], string> = {
  pending: "Bekliyor",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<VendorPayout["status"], string> = {
  pending: "warn",
  paid: "success",
  rejected: "danger",
};

const REFUND_STATUS: Record<VendorFinanceRefund["status"], [string, string]> = {
  pending: ["warn", "Bekliyor"],
  approved: ["success", "Onaylandı"],
  rejected: ["danger", "Reddedildi"],
};

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function FinancePanel() {
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [earnings, setEarnings] = useState<VendorEarning[]>([]);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [refunds, setRefunds] = useState<VendorFinanceRefund[]>([]);
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoadError(null);
    try {
      const [w, e, p, r] = await Promise.all([
        fetchJson<VendorWallet>("/vendor/wallet"),
        fetchJson<VendorEarning[]>("/vendor/earnings"),
        fetchJson<VendorPayout[]>("/vendor/payouts"),
        fetchJson<VendorFinanceRefund[]>("/vendor/finance-refunds"),
      ]);
      setWallet(w);
      setEarnings(e);
      setPayouts(p);
      setRefunds(r);
      setIban((current) => current || w.bankIban || "");
      setAccountHolder((current) => current || w.bankAccountHolder || "");
    } catch (err) {
      setLoadError(err instanceof ClientApiError ? err.message : "Finans bilgileri yüklenemedi");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 50) {
      setError("Minimum ödeme talebi tutarı 50 ₺'dir.");
      return;
    }
    if (wallet && numAmount > Number(wallet.walletBalance)) {
      setError(`Yetersiz bakiye. Mevcut bakiyeniz: ${tl(wallet.walletBalance)}`);
      return;
    }
    if (accountHolder.trim().length < 2) {
      setError("Hesap sahibinin adını girin.");
      return;
    }
    setLoading(true);
    try {
      await mutateJson("/vendor/payouts", "POST", { amount: numAmount, iban, accountHolder, note: note || undefined });
      setSuccess(`${tl(String(numAmount))} tutarında ödeme talebiniz alındı. 2-3 iş günü içinde hesabınıza aktarılacaktır.`);
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Talep oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  if (wallet === null) {
    return (
      <div className="card">
        <div className="card-body">
          {loadError ? (
            <div className="alert alert-er" role="alert">
              <i className="fas fa-exclamation-circle" /> {loadError}
              <button type="button" className="btn btn-sec btn-sm" onClick={() => void load()} style={{ marginLeft: 12 }}>
                Tekrar Dene
              </button>
            </div>
          ) : (
            "Yükleniyor..."
          )}
        </div>
      </div>
    );
  }

  const balance = Number(wallet.walletBalance);

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-wallet" /> Mevcut Bakiye</div>
          <div className="sc-val" style={{ color: "var(--ok)" }}>{tl(wallet.walletBalance)}</div>
          <div className="sc-sub">Çekilebilir tutar</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-coins" /> Toplam Kazanç</div>
          <div className="sc-val" style={{ color: "var(--pr)" }}>{tl(wallet.totalNet)}</div>
          <div className="sc-sub">Tüm zamanlar</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-clock" /> Bekleyen Kazanç</div>
          <div className="sc-val" style={{ color: "var(--wa)" }}>{tl(wallet.pendingEarnings)}</div>
          <div className="sc-sub">Teslimat bekliyor</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-percent" /> Komisyon Oranınız</div>
          <div className="sc-val" style={{ color: "var(--tx2)" }}>%{wallet.commissionRate}</div>
          <div className="sc-sub">Her satıştan platforma kesilen pay</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-check-double" /> Toplam Ödeme</div>
          <div className="sc-val" style={{ color: "var(--in)" }}>{tl(wallet.totalPaidOut)}</div>
          <div className="sc-sub">Aktarılan tutar</div>
        </div>
      </div>

      {loadError && <div className="alert alert-er" role="alert">{loadError}</div>}

      <div className="finance-layout">
        <div className="card">
          <div className="ch">
            <h3><i className="fas fa-receipt" style={{ color: "var(--pr)" }} /> Kazanç Geçmişi</h3>
          </div>
          {earnings.length === 0 ? (
            <div className="empty">
              <i className="fas fa-coins" />
              <p>Henüz kazanç kaydı yok.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Sipariş</th>
                    <th>Ürün</th>
                    <th>Tutar</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.id}>
                      <td style={{ color: "var(--tx3)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {new Date(e.createdAt).toLocaleDateString("tr-TR")}
                      </td>
                      <td>
                        {e.orderNumber ? (
                          <span style={{ color: "var(--pr)", fontWeight: 600 }}>#{e.orderNumber}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--tx2)" }}>{e.productName ?? "—"}</td>
                      <td style={{ fontWeight: 700, color: "var(--ok)" }}>{tl(e.netAmount)}</td>
                      <td>
                        <span className="st st-success">Ödendi</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="ch">
              <h3><i className="fas fa-paper-plane" style={{ color: "var(--pr)" }} /> Ödeme Talebi</h3>
            </div>
            <div className="card-body fc">
              {balance < 50 && (
                <div className="alert alert-wa">
                  <i className="fas fa-info-circle" /> Ödeme talebi için minimum 50 ₺ bakiyeniz olmalıdır.
                </div>
              )}
                <form className="fc" onSubmit={handleSubmit}>
                  <div className="payout-account-summary">
                    <strong>Ödeme yapılacak hesap</strong>
                    <span>Bu bilgiler kaydedilir ve sonraki talebinizde otomatik doldurulur.</span>
                    <Link href="/satici/panel/ayarlar">Banka ayarlarına git</Link>
                  </div>
                  <div className="fg">
                    <label>Hesap Sahibi <span className="req">*</span></label>
                    <input
                      className="fi"
                      required
                      maxLength={120}
                      autoComplete="name"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Ad Soyad / Firma Unvanı"
                    />
                  </div>
                  <div className="fg">
                    <label>Talep Tutarı (₺) <span className="req">*</span></label>
                    <input
                      className="fi"
                      type="number"
                      required
                      min={50}
                      max={balance}
                      step="0.01"
                      placeholder="Miktar girin"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <small style={{ color: "var(--tx3)", fontSize: 11 }}>Mevcut bakiye: {tl(wallet.walletBalance)}</small>
                  </div>
                  <div className="fg">
                    <label>IBAN <span className="req">*</span></label>
                    <input className="fi" required inputMode="text" autoComplete="off" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="TR00 0000 0000 0000 0000 0000 00" />
                  </div>
                  <div className="fg">
                    <label>Not</label>
                    <textarea className="fi" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı not..." />
                  </div>
                  {error && <p role="alert" style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
                  {success && <p aria-live="polite" style={{ color: "var(--ok)", fontSize: "0.85rem" }}>{success}</p>}
                  <button className="btn btn-pr" type="submit" disabled={loading || balance < 50}>
                    <i className="fas fa-paper-plane" /> {loading ? "Gönderiliyor..." : "Talep Gönder"}
                  </button>
                </form>
            </div>
          </div>

          <div className="card">
            <div className="ch">
              <h3><i className="fas fa-history" style={{ color: "var(--pr)" }} /> Ödeme Talepleri</h3>
            </div>
            {payouts.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>
                <i className="fas fa-file-invoice-dollar" />
                <p>Ödeme talebi yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {payouts.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--br)" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--ok)" }}>{tl(p.amount)}</div>
                      <div style={{ fontSize: 11, color: "var(--tx3)" }}>{new Date(p.requestedAt).toLocaleDateString("tr-TR")}</div>
                    </div>
                    <span className={`st st-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ch">
              <h3><i className="fas fa-undo" style={{ color: "var(--er)" }} /> İadeler</h3>
            </div>
            {refunds.length === 0 ? (
              <div className="empty" style={{ padding: 30 }}>
                <i className="fas fa-undo" />
                <p>İade kaydı yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {refunds.map((r) => {
                  const [cls, label] = REFUND_STATUS[r.status];
                  return (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--br)" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--er)" }}>{tl(r.amount)}</div>
                        <div style={{ fontSize: 11, color: "var(--tx3)" }}>
                          {r.orderNumber ? `#${r.orderNumber}` : "—"}
                          {r.reason ? ` · ${r.reason}` : ""}
                        </div>
                      </div>
                      <span className={`st st-${cls}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
