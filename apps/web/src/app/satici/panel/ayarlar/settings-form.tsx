"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";
import CloseAccountButton from "./close-account-button";

export default function SettingsForm() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankCurrentPassword, setBankCurrentPassword] = useState("");
  const [bankOwnershipConfirmed, setBankOwnershipConfirmed] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
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
      setPhone(v.phone ?? "");
      setBankName(v.bankName ?? "");
      setBankIban(v.bankIban ?? "");
      setBankAccountHolder(v.bankAccountHolder ?? "");
      setTaxId(v.taxId ?? "");
      setLegalAddress(v.legalAddress ?? "");
    });
  }, []);

  async function handleBankSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    setBankMessage(null);
    try {
      const updated = await mutateJson<VendorProfile>("/vendor/auth/me", "PATCH", {
        phone,
        bankName,
        bankIban,
        bankAccountHolder,
        taxId,
        legalAddress,
        ...(bankDetailsChanged
          ? { currentPassword: bankCurrentPassword, bankOwnershipConfirmed }
          : {}),
      });
      setVendor(updated);
      setBankMessage({ type: "ok", text: "Hesap bilgileri kaydedildi. Banka hesabı değiştiyse güvenlik için ödemeler 24 saat sonra açılır." });
      setBankCurrentPassword("");
      setBankOwnershipConfirmed(false);
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

  const bankDetailsChanged =
    bankName.trim() !== (vendor.bankName ?? "").trim()
    || bankIban.replace(/\s/g, "").toUpperCase() !== (vendor.bankIban ?? "").replace(/\s/g, "").toUpperCase()
    || bankAccountHolder.trim() !== (vendor.bankAccountHolder ?? "").trim();

  return (
    <div className="row2" style={{ alignItems: "start" }}>
      <div className="card">
        <div className="ch">
          <h3><i className="fas fa-wallet" style={{ color: "var(--pr)" }} /> Ödeme & İletişim</h3>
        </div>
        <div className="card-body">
          <form className="fc" onSubmit={handleBankSubmit}>
            <div className="fg">
              <label>E-Posta</label>
              <input className="fi" type="email" value={vendor.email} disabled />
            </div>
            <div className="fg">
              <label>Telefon</label>
              <input className="fi" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
            </div>
            <div className="fg">
              <label>Vergi Numarası / TC Kimlik No</label>
              <input className="fi" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Fatura ve sözleşmelerde kullanılır" />
            </div>
            <div className="fg">
              <label>Adres</label>
              <textarea className="fi" rows={2} value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} placeholder="Fatura ve sözleşmelerde kullanılan yasal adresiniz" />
            </div>
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
            <div className="fg">
              <label>Mevcut Şifre <span className="req">*</span></label>
              <input className="fi" type="password" required={bankDetailsChanged} value={bankCurrentPassword} onChange={(e) => setBankCurrentPassword(e.target.value)} autoComplete="current-password" />
              <small>{bankDetailsChanged ? "Banka hesabı değişikliği için yeniden doğrulama zorunludur." : "Yalnız banka hesabını değiştirirken gereklidir."}</small>
            </div>
            <label className="ga-consent">
              <input type="checkbox" required={bankDetailsChanged} checked={bankOwnershipConfirmed} onChange={(e) => setBankOwnershipConfirmed(e.target.checked)} />
              Bu banka hesabının bana veya işletmeme ait olduğunu onaylıyorum.
            </label>
            {bankMessage && <p style={{ color: bankMessage.type === "ok" ? "var(--ok)" : "var(--er)", fontSize: "0.85rem" }}>{bankMessage.text}</p>}
            <div>
              <button className="btn btn-pr" type="submit" disabled={savingBank}>
                <i className="fas fa-save" /> {savingBank ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3><i className="fas fa-lock" style={{ color: "var(--pr)" }} /> Şifre Değiştir</h3>
        </div>
        <div className="card-body">
          <form className="fc" onSubmit={handlePasswordSubmit}>
            <div className="fg">
              <label>Mevcut Şifre <span className="req">*</span></label>
              <input className="fi" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Yeni Şifre <span className="req">*</span></label>
              <input className="fi" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="fg">
              <label>Yeni Şifre (Tekrar) <span className="req">*</span></label>
              <input className="fi" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>
            {passwordMessage && (
              <p style={{ color: passwordMessage.type === "ok" ? "var(--ok)" : "var(--er)", fontSize: "0.85rem" }}>{passwordMessage.text}</p>
            )}
            <div>
              <button className="btn btn-pr" type="submit" disabled={savingPassword}>
                <i className="fas fa-key" /> {savingPassword ? "Kaydediliyor..." : "Şifreyi Güncelle"}
              </button>
            </div>
          </form>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--br)" }}>
            <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 8 }}>
              Mağaza görünümü, logo ve sosyal medya için:
            </div>
            <Link href="/satici/panel/magaza" className="btn btn-sec btn-sm">
              <i className="fas fa-store" /> Mağaza Profili
            </Link>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--br)" }}>
            <CloseAccountButton />
          </div>
        </div>
      </div>
    </div>
  );
}
