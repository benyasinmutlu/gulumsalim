"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorPayout, VendorWallet } from "@/lib/types";

const STATUS_LABEL: Record<VendorPayout["status"], string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<VendorPayout["status"], string> = {
  pending: "warn",
  paid: "success",
  rejected: "danger",
};

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function FinancePanel() {
  const [wallet, setWallet] = useState<VendorWallet | null>(null);
  const [payouts, setPayouts] = useState<VendorPayout[]>([]);
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [w, p] = await Promise.all([
      fetchJson<VendorWallet>("/vendor/wallet"),
      fetchJson<VendorPayout[]>("/vendor/payouts"),
    ]);
    setWallet(w);
    setPayouts(p);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/vendor/payouts", "POST", { amount: Number(amount), iban, note: note || undefined });
      setAmount("");
      setIban("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Talep oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  if (wallet === null) return <div className="card"><div className="card-body">Yükleniyor...</div></div>;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label">
            <i className="fas fa-wallet" /> Kullanılabilir Bakiye
          </div>
          <div className="sc-val" style={{ color: "var(--ok)" }}>{tl(wallet.walletBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">
            <i className="fas fa-coins" /> Toplam Net Kazanç
          </div>
          <div className="sc-val">{tl(wallet.totalNet)}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">
            <i className="fas fa-hand-holding-usd" /> Ödenen Toplam
          </div>
          <div className="sc-val">{tl(wallet.totalPaidOut)}</div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Ödeme Talebi Oluştur</h3>
        </div>
        <form className="fc" style={{ padding: "20px" }} onSubmit={handleSubmit}>
          <div className="fg">
            <label>Tutar (₺)</label>
            <input className="fi" type="number" required min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="fg">
            <label>IBAN</label>
            <input className="fi" required value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR..." />
          </div>
          <div className="fg">
            <label>Not (opsiyonel)</label>
            <input className="fi" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Gönderiliyor..." : "Talep Oluştur"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Ödeme Talepleri</h3>
        </div>
        {payouts.length === 0 ? (
          <div className="empty">
            <i className="fas fa-wallet" />
            <p>Henüz ödeme talebiniz yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tutar</th>
                  <th>IBAN</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{tl(p.amount)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{p.iban}</td>
                    <td>
                      <span className={`st st-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--tx3)" }}>{new Date(p.requestedAt).toLocaleDateString("tr-TR")}</td>
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
