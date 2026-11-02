"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import { hardNavigateInternal } from "@/lib/navigation";
import type { AdminLoginResponse, AdminMfaEnableResponse, AdminMfaSetup, AdminProfile } from "@/lib/types";

type LoginStep = "credentials" | "verify" | "enroll" | "recovery";

export default function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>("credentials");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<AdminMfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await mutateJson<AdminLoginResponse>("/admin/auth/login", "POST", { username, password });
      setPassword("");
      if (result.mfaEnrollmentRequired) {
        const mfaSetup = await mutateJson<AdminMfaSetup>("/admin/auth/mfa/setup", "POST");
        setSetup(mfaSetup);
        setStep("enroll");
      } else if (result.mfaRequired) {
        setStep("verify");
      } else {
        throw new Error("Beklenmeyen giriş yanıtı");
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Giriş başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (step === "enroll") {
        const result = await mutateJson<AdminMfaEnableResponse>("/admin/auth/mfa/enable", "POST", { code });
        setRecoveryCodes(result.recoveryCodes);
        setCode("");
        setStep("recovery");
      } else {
        await mutateJson<AdminProfile>("/admin/auth/mfa/verify", "POST", { code });
        hardNavigateInternal("/admin/panel");
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Doğrulama başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  if (step === "recovery") {
    return (
      <div className="admin-mfa-recovery">
        <div className="admin-mfa-notice">
          <i className="fas fa-shield-alt" />
          <div><strong>Kurtarma kodlarını güvenli bir yere kaydet</strong><p>Her kod yalnızca bir kez kullanılabilir. Telefonuna erişemezsen bu kodlardan biriyle giriş yapabilirsin.</p></div>
        </div>
        <div className="admin-mfa-codes" aria-label="Kurtarma kodları">
          {recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}
        </div>
        <button className="admin-btn admin-btn-primary" style={{ width: "100%" }} type="button" onClick={() => hardNavigateInternal("/admin/panel")}>
          Kodları Kaydettim, Panele Git
        </button>
      </div>
    );
  }

  if (step === "verify" || step === "enroll") {
    return (
      <form onSubmit={handleMfa}>
        {error && <div className="login-error"><i className="fas fa-exclamation-circle" /> {error}</div>}
        {step === "enroll" && setup && (
          <div className="admin-mfa-setup">
            <p>Authenticator uygulamanla QR kodunu tara, ardından uygulamadaki 6 haneli kodu gir.</p>
            {/* QR yalnız sunucunun bu oturuma özel ürettiği data URL'dir. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrCodeDataUrl} alt="Authenticator kurulum QR kodu" width={240} height={240} />
            <span>Elle kurulum anahtarı</span>
            <code>{setup.secret}</code>
          </div>
        )}
        {step === "verify" && (
          <div className="admin-mfa-notice">
            <i className="fas fa-mobile-alt" />
            <div><strong>İki aşamalı doğrulama</strong><p>Authenticator kodunu veya tek kullanımlık kurtarma kodunu gir.</p></div>
          </div>
        )}
        <div className="admin-form-group">
          <label>{step === "enroll" ? "6 Haneli Doğrulama Kodu" : "Doğrulama veya Kurtarma Kodu"}</label>
          <div className="login-input-wrap">
            <i className="fas fa-key" />
            <input className="admin-form-control admin-mfa-code-input" inputMode="text" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" />
          </div>
        </div>
        <button className="admin-btn admin-btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
          <i className="fas fa-shield-alt" /> {loading ? "Doğrulanıyor..." : step === "enroll" ? "Kurulumu Tamamla" : "Doğrula ve Giriş Yap"}
        </button>
        <button className="admin-mfa-back" type="button" onClick={() => { setStep("credentials"); setCode(""); setError(null); }}>
          Kullanıcı girişine dön
        </button>
      </form>
    );
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
