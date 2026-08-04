"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

export default function VendorLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(false);
    setResendSent(false);
    try {
      await mutateJson<VendorProfile>("/vendor/auth/login", "POST", { email, password });
      window.location.href = "/satici/panel";
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError(err.message);
        setNeedsVerification(err.code === "email_not_verified");
      } else {
        setError("Giriş başarısız oldu");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    await mutateJson("/vendor/auth/resend-verification", "POST", { email });
    setResendSent(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert">
          <i className="fas fa-exclamation-circle" /> {error}
          {needsVerification && !resendSent && (
            <>
              {" "}
              <button type="button" onClick={handleResendVerification} style={{ textDecoration: "underline", color: "inherit" }}>
                Doğrulama e-postasını tekrar gönder
              </button>
            </>
          )}
          {resendSent && <p style={{ marginTop: 6 }}>Doğrulama e-postası tekrar gönderildi.</p>}
        </div>
      )}

      <div className="ga-fg">
        <label>E-Posta Adresi</label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input className="ga-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="ga-fg">
        <label>Şifre</label>
        <div className="ga-input-wrap">
          <i className="fas fa-lock ga-ic" />
          <input
            className="ga-input"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="ga-pw-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Şifreyi göster/gizle">
            <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} />
          </button>
        </div>
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <Link href="/satici/sifremi-unuttum" style={{ fontSize: "0.85rem" }}>
            Şifremi Unuttum?
          </Link>
        </div>
      </div>

      <button className="ga-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? "Giriş yapılıyor..." : "Satıcı Girişi Yap"}
      </button>
    </form>
  );
}
