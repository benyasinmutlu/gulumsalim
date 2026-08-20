"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";
import GoogleSignInButton from "@/components/google-signin-button";

export default function LoginForm() {
  const searchParams = useSearchParams();
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
      await mutateJson<CustomerProfile>("/auth/login", "POST", { email, password });
      const redirect = searchParams.get("redirect");
      // router.push+refresh burada güvenilir değil (bkz. logout-button.tsx'teki
      // aynı kök sebep) - giriş sonrası hedef sayfa bazen hâlâ "giriş
      // yapılmamış" gibi görünebiliyordu. Tam sayfa yönlendirme kullanılıyor.
      window.location.href = redirect && redirect.startsWith("/") ? redirect : "/";
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
    await mutateJson("/auth/resend-verification", "POST", { email });
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
        <label htmlFor="customer-login-email">E-Posta Adresi</label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input
            id="customer-login-email"
            name="email"
            className="ga-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="ga-fg">
        <label htmlFor="customer-login-password">Şifre</label>
        <div className="ga-input-wrap">
          <i className="fas fa-lock ga-ic" />
          <input
            id="customer-login-password"
            name="password"
            className="ga-input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="ga-pw-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label="Şifreyi göster/gizle"
          >
            <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} />
          </button>
        </div>
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <Link href="/sifremi-unuttum" style={{ fontSize: "0.85rem" }}>
            Şifremi Unuttum?
          </Link>
        </div>
      </div>

      <button className="ga-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>

      <GoogleSignInButton onError={setError} />
    </form>
  );
}
