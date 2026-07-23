"use client";

import { useState, type FormEvent } from "react";
import { mutateJson } from "@/lib/client-api";

export default function VendorForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await mutateJson("/vendor/auth/forgot-password", "POST", { email });
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="ga-alert" style={{ background: "var(--color-success-bg, #E8F5E9)", color: "var(--color-success, #2E7D32)" }}>
        <i className="fas fa-check-circle" /> Bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="ga-fg">
        <label>E-Posta Adresi</label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input className="ga-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <button className="ga-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
      </button>
    </form>
  );
}
