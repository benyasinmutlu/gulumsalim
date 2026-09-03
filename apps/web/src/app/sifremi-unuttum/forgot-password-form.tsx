"use client";

import { useState, type FormEvent } from "react";
import { mutateJson } from "@/lib/client-api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Hangi e-postaların kayıtlı olduğunu sızdırmamak için backend her
      // zaman aynı yanıtı döner (bkz. auth.routes.ts) - bu yüzden burada
      // hata dalı yok, her zaman başarı ekranına geçilir.
      await mutateJson("/auth/forgot-password", "POST", { email });
      setSent(true);
    } catch {
      setError("Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="ga-alert" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
        <i className="fas fa-check-circle" /> Bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü) kontrol edin.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert" role="alert">
          <i className="fas fa-circle-exclamation" /> {error}
        </div>
      )}
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
