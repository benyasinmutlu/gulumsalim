import { Suspense } from "react";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import VendorResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = { title: "Şifre Sıfırla | Gülüm Şalım Satıcı Paneli" };

export default function VendorResetPasswordPage() {
  return (
    <AuthLayout
      backHref="/satici/giris"
      backLabel="Girişe Dön"
      headline={
        <>
          Yeni bir <em>şifre</em> belirleyin
        </>
      }
      lede="Satıcı hesabınız için güvenli bir şifre seçin."
      title="Şifre Sıfırla"
      subtitle="Yeni şifrenizi girin."
    >
      <Suspense fallback={null}>
        <VendorResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
