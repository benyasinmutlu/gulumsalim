"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson<CustomerProfile>("/auth/login", "POST", { email, password });
      const redirect = searchParams.get("redirect");
      // router.push+refresh burada güvenilir değil (bkz. logout-button.tsx'teki
      // aynı kök sebep) - giriş sonrası hedef sayfa bazen hâlâ "giriş
      // yapılmamış" gibi görünebiliyordu. Tam sayfa yönlendirme kullanılıyor.
      window.location.href = redirect && redirect.startsWith("/") ? redirect : "/";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="ga-alert">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      <div className="ga-fg">
        <label>E-Posta Adresi</label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input
            className="ga-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
    </form>
  );
}
