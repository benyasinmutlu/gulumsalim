import { Suspense } from "react";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = { title: "Şifre Sıfırla | Gülüm Şalım" };

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      backHref="/giris"
      backLabel="Girişe Dön"
      headline={
        <>
          Yeni bir <em>şifre</em> belirleyin
        </>
      }
      lede="Hesabınız için güvenli bir şifre seçin."
      title="Şifre Sıfırla"
      subtitle="Yeni şifrenizi girin."
    >
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
