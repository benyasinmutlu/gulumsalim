"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";

export default function RegisterForm() {
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (!consent) {
      setError("Devam etmek için Üyelik Sözleşmesini ve KVKK Aydınlatma Metnini kabul etmelisiniz");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<CustomerProfile>("/auth/register", "POST", {
        fullName: `${firstName} ${lastName}`.trim(),
        email,
        phone: phone || undefined,
        password,
      });
      const redirect = searchParams.get("redirect");
      window.location.href = redirect && redirect.startsWith("/") ? redirect : "/";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kayıt başarısız oldu");
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

      <div className="ga-row2">
        <div className="ga-fg">
          <label>
            Adınız <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input className="ga-input" type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
        </div>
        <div className="ga-fg">
          <label>
            Soyadınız <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input className="ga-input" type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ga-fg">
        <label>
          E-Posta Adresi <span className="req">*</span>
        </label>
        <div className="ga-input-wrap">
          <i className="fas fa-envelope ga-ic" />
          <input className="ga-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="ga-fg">
        <label>Telefon Numarası</label>
        <div className="ga-input-wrap">
          <i className="fas fa-phone ga-ic" />
          <input className="ga-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div className="ga-row2">
        <div className="ga-fg">
          <label>
            Şifre <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
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
          <label>
            Şifre Tekrar <span className="req">*</span>
          </label>
          <div className="ga-input-wrap">
            <input
              className="ga-input"
              type={showPassword ? "text" : "password"}
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <label className="ga-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Üyelik Sözleşmesini ve KVKK Aydınlatma Metnini okudum, kabul ediyorum.
      </label>

      <button className="ga-submit" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Kayıt Ol"}
      </button>
    </form>
  );
}
