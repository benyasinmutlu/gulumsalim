"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { AdminProfile } from "@/lib/types";

export default function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson<AdminProfile>("/admin/auth/login", "POST", { username, password });
      window.location.href = "/admin/panel";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="login-error">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}
      <div className="admin-form-group">
        <label>Kullanıcı Adı</label>
        <div className="login-input-wrap">
          <i className="fas fa-user" />
          <input className="admin-form-control" placeholder="admin" required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      </div>
      <div className="admin-form-group">
        <label>Şifre</label>
        <div className="login-input-wrap">
          <i className="fas fa-lock" />
          <input className="admin-form-control" type="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      <button className="admin-btn admin-btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
        <i className="fas fa-sign-in-alt" /> {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
      </button>
      <Link href="/" className="login-back-link">
        <i className="fas fa-arrow-left" /> Mağazaya Dön
      </Link>
    </form>
  );
}
