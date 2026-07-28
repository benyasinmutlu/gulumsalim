"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";

export default function VendorResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Girdiğiniz şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    try {
      await mutateJson("/vendor/auth/reset-password", "POST", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Şifre sıfırlanamadı");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="ga-alert">
        <i className="fas fa-exclamation-circle" /> Geçersiz bağlantı. Lütfen e-postanızdaki bağlantıyı tekrar açın.
      </div>
    );
  }

  if (done) {
    return (
      <div className="ga-alert" style={{ background: "var(--color-success-bg, #E8F5E9)", color: "var(--color-success, #2E7D32)" }}>
        <i className="fas fa-check-circle" /> Şifreniz güncellendi. Artık yeni şifrenizle{" "}
        <a href="/satici/giris" style={{ textDecoration: "underline" }}>
          giriş yapabilirsiniz
        </a>
        .
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      <div className="ga-fg">
        <label>Yeni Şifre</label>
        <div className="ga-input-wrap">
          <i className="fas fa-lock ga-ic" />
          <input
            className="ga-input"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="ga-pw-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Şifreyi göster/gizle">
            <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} />
          </button>
        </div>
      </div>

      <div className="ga-fg">
        <label>Yeni Şifre (Tekrar)</label>
        <div className="ga-input-wrap">
          <i className="fas fa-lock ga-ic" />
          <input
            className="ga-input"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </div>

      <button className="ga-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
        {loading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
      </button>
    </form>
  );
}
