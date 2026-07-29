"use client";

import { useState, type FormEvent } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";
import { AuthAlert, AuthField, AuthSectionTitle, AuthSubmit, FieldRow } from "@/components/auth/auth-controls";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function VendorRegisterForm() {
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleStoreNameChange(value: string) {
    setStoreName(value);
    if (!slugTouched) setStoreSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson<VendorProfile>("/vendor/auth/register", "POST", {
        storeName,
        storeSlug,
        fullName,
        phone: phone || undefined,
        email,
        password,
      });
      window.location.href = "/satici/panel";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kayıt başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <AuthAlert>{error}</AuthAlert>}

      <AuthField label="Mağaza Adı" icon="fas fa-store" required value={storeName} onValueChange={handleStoreNameChange} />

      <AuthField
        label={`Mağaza Adresi (/${storeSlug || "magaza-adiniz"})`}
        icon="fas fa-link"
        required
        value={storeSlug}
        onValueChange={(value) => {
          setSlugTouched(true);
          setStoreSlug(slugify(value));
        }}
      />

      <AuthSectionTitle>Kişisel Bilgiler</AuthSectionTitle>
      <FieldRow>
        <AuthField label="Ad Soyad" required value={fullName} onValueChange={setFullName} autoComplete="name" />
        <AuthField label="Telefon" type="tel" value={phone} onValueChange={setPhone} autoComplete="tel" inputMode="tel" />
      </FieldRow>

      <AuthSectionTitle>Hesap Güvenliği</AuthSectionTitle>
      <AuthField
        label="E-posta Adresi"
        icon="fas fa-envelope"
        type="email"
        required
        value={email}
        onValueChange={setEmail}
        autoComplete="email"
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

      <AuthSubmit loading={loading} loadingLabel="Gönderiliyor...">
        Başvuruyu Gönder
      </AuthSubmit>
    </form>
  );
}
