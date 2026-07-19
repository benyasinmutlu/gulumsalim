"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorPayout, VendorWallet } from "@/lib/types";

const STATUS_LABEL: Record<VendorPayout["status"], string> = {
  pending: "Beklemede",
  paid: "Ödendi",
  rejected: "Reddedildi",
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

  if (wallet === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">Kullanılabilir Bakiye</div>
          <div className="value">{tl(wallet.walletBalance)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Toplam Net Kazanç</div>
          <div className="value">{tl(wallet.totalNet)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Ödenen Toplam</div>
          <div className="value">{tl(wallet.totalPaidOut)}</div>
        </div>
      </div>

      <h3 style={{ fontSize: "0.95rem", marginTop: "2rem", marginBottom: "0.75rem" }}>Ödeme Talebi Oluştur</h3>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Tutar (₺)
          <input type="number" required min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label>
          IBAN
          <input required value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR..." />
        </label>
        <label>
          Not (opsiyonel)
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Gönderiliyor..." : "Talep Oluştur"}
        </button>
      </form>

      <h3 style={{ fontSize: "0.95rem", marginTop: "2rem", marginBottom: "0.75rem" }}>Ödeme Talepleri</h3>
      {payouts.length === 0 ? (
        <p className="empty-state">Henüz ödeme talebiniz yok.</p>
      ) : (
        <table className="data-table">
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
                  <span className="badge">{STATUS_LABEL[p.status]}</span>
                </td>
                <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{new Date(p.requestedAt).toLocaleDateString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
