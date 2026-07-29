"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";
import { AuthAlert, AuthConsent, AuthField, AuthSubmit, FieldRow } from "@/components/auth/auth-controls";

export default function RegisterForm() {
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
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
    <form onSubmit={handleSubmit} noValidate>
      {error && <AuthAlert>{error}</AuthAlert>}

      <FieldRow>
        <AuthField label="Adınız" required value={firstName} onValueChange={setFirstName} autoComplete="given-name" />
        <AuthField label="Soyadınız" required value={lastName} onValueChange={setLastName} autoComplete="family-name" />
      </FieldRow>

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
        label="Telefon Numarası"
        icon="fas fa-phone"
        type="tel"
        value={phone}
        onValueChange={setPhone}
        autoComplete="tel"
        inputMode="tel"
      />

      <FieldRow>
        <AuthField
          label="Şifre"
          type="password"
          required
          minLength={8}
          value={password}
          onValueChange={setPassword}
          autoComplete="new-password"
        />
        <AuthField
          label="Şifre Tekrar"
          type="password"
          required
          value={passwordConfirm}
          onValueChange={setPasswordConfirm}
          autoComplete="new-password"
        />
      </FieldRow>

      <AuthConsent checked={consent} onCheckedChange={setConsent}>
        Üyelik Sözleşmesini ve KVKK Aydınlatma Metnini okudum, kabul ediyorum.
      </AuthConsent>

      <AuthSubmit loading={loading} loadingLabel="Kaydediliyor...">
        Kayıt Ol
      </AuthSubmit>
    </form>
  );
}
