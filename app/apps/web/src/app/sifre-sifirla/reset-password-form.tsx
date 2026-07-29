"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-controls";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      await mutateJson("/auth/reset-password", "POST", { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Şifre sıfırlanamadı");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <AuthAlert>Geçersiz bağlantı. Lütfen e-postanızdaki bağlantıyı tekrar açın.</AuthAlert>;
  }

  if (done) {
    return (
      <AuthAlert variant="success">
        Şifreniz güncellendi. Artık yeni şifrenizle <Link href="/giris">giriş yapabilirsiniz</Link>.
      </AuthAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <AuthAlert>{error}</AuthAlert>}
      <AuthField
        label="Yeni Şifre"
        icon="fas fa-lock"
        type="password"
        required
        minLength={8}
        value={password}
        onValueChange={setPassword}
        autoComplete="new-password"
      />
      <AuthField
        label="Yeni Şifre (Tekrar)"
        icon="fas fa-lock"
        type="password"
        required
        minLength={8}
        value={confirmPassword}
        onValueChange={setConfirmPassword}
        autoComplete="new-password"
      />
      <AuthSubmit loading={loading} loadingLabel="Kaydediliyor...">
        Şifreyi Güncelle
      </AuthSubmit>
    </form>
  );
}
