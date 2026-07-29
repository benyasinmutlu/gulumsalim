"use client";

import { useState, type FormEvent } from "react";
import { mutateJson } from "@/lib/client-api";
import { AuthAlert, AuthField, AuthSubmit } from "@/components/auth/auth-controls";

export default function VendorForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await mutateJson("/vendor/auth/forgot-password", "POST", { email });
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <AuthAlert variant="success">
        Bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu (ve spam klasörünü)
        kontrol edin.
      </AuthAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <AuthField
        label="E-Posta Adresi"
        icon="fas fa-envelope"
        type="email"
        required
        value={email}
        onValueChange={setEmail}
        autoComplete="email"
      />
      <AuthSubmit loading={loading} loadingLabel="Gönderiliyor...">
        Sıfırlama Bağlantısı Gönder
      </AuthSubmit>
    </form>
  );
}
