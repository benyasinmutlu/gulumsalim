"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

export default function SettingsForm() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankMessage, setBankMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchJson<VendorProfile>("/vendor/auth/me").then((v) => {
      setVendor(v);
      setBankName(v.bankName ?? "");
      setBankIban(v.bankIban ?? "");
      setBankAccountHolder(v.bankAccountHolder ?? "");
    });
  }, []);

  async function handleBankSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    setBankMessage(null);
    try {
      await mutateJson<VendorProfile>("/vendor/auth/me", "PATCH", { bankName, bankIban, bankAccountHolder });
      setBankMessage({ type: "ok", text: "Banka bilgileri güncellendi" });
    } catch (err) {
      setBankMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Kaydedilemedi" });
    } finally {
      setSavingBank(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "err", text: "Yeni şifre en az 8 karakter olmalı" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "err", text: "Yeni şifreler eşleşmiyor" });
      return;
    }
    setSavingPassword(true);
    try {
      await mutateJson<VendorProfile>("/vendor/auth/me", "PATCH", { currentPassword, newPassword });
      setPasswordMessage({ type: "ok", text: "Şifreniz güncellendi" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Şifre güncellenemedi" });
    } finally {
      setSavingPassword(false);
    }
  }

  if (!vendor) {
    return <div className="card"><div className="card-body">Yükleniyor...</div></div>;
  }

  return (
    <div className="fc" style={{ gap: 20 }}>
      <div className="card">
        <div className="ch">
          <h3>Şifre Değiştir</h3>
        </div>
        <div className="card-body">
          <form className="fc" onSubmit={handlePasswordSubmit}>
            <div className="fg">
              <label>Mevcut Şifre</label>
              <input className="fi" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="row2">
              <div className="fg">
                <label>Yeni Şifre</label>
                <input className="fi" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="fg">
                <label>Yeni Şifre (Tekrar)</label>
                <input className="fi" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
              </div>
            </div>
            {passwordMessage && (
              <p style={{ color: passwordMessage.type === "ok" ? "var(--su, green)" : "var(--er)", fontSize: "0.85rem" }}>{passwordMessage.text}</p>
            )}
            <button className="btn btn-pr" type="submit" disabled={savingPassword} style={{ alignSelf: "flex-start" }}>
              {savingPassword ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Ödeme Bilgileri</h3>
        </div>
        <div className="card-body">
          <form className="fc" onSubmit={handleBankSubmit}>
            <div className="fg">
              <label>Banka Adı</label>
              <input className="fi" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div className="fg">
              <label>IBAN</label>
              <input className="fi" value={bankIban} onChange={(e) => setBankIban(e.target.value)} placeholder="TR.." />
            </div>
            <div className="fg">
              <label>Hesap Sahibi</label>
              <input className="fi" value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} />
            </div>
            {bankMessage && <p style={{ color: bankMessage.type === "ok" ? "var(--su, green)" : "var(--er)", fontSize: "0.85rem" }}>{bankMessage.text}</p>}
            <button className="btn btn-pr" type="submit" disabled={savingBank} style={{ alignSelf: "flex-start" }}>
              {savingBank ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
