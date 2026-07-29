"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";
import { AuthAlert, AuthField, AuthLink, AuthSubmit } from "@/components/auth/auth-controls";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <form onSubmit={handleSubmit} noValidate>
      {error && <AuthAlert>{error}</AuthAlert>}

      <AuthField
        label="E-Posta Adresi"
        icon="fas fa-envelope"
        type="email"
        required
        value={email}
        onValueChange={setEmail}
        autoComplete="email"
      />

      <AuthField
        label="Şifre"
        icon="fas fa-lock"
        type="password"
        required
        value={password}
        onValueChange={setPassword}
        autoComplete="current-password"
        extra={<AuthLink href="/sifremi-unuttum">Şifremi Unuttum?</AuthLink>}
      />

      <AuthSubmit loading={loading} loadingLabel="Giriş yapılıyor...">
        Giriş Yap
      </AuthSubmit>
    </form>
  );
}
