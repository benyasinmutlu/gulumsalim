import Link from "next/link";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import VendorForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi Unuttum | Gülüm Şalım Satıcı Paneli" };

export default function VendorForgotPasswordPage() {
  return (
    <AuthLayout
      backHref="/satici/giris"
      backLabel="Girişe Dön"
      headline={
        <>
          Şifrenizi mi <em>unuttunuz?</em>
        </>
      }
      lede="Satıcı hesabınızın e-posta adresine birkaç dakika içinde bir sıfırlama bağlantısı gönderelim."
      title="Şifremi Unuttum"
      subtitle="Satıcı hesabınıza kayıtlı e-posta adresini girin."
      footer={
        <>
          Şifrenizi hatırladınız mı? <Link href="/satici/giris">Giriş Yap</Link>
        </>
      }
    >
      <VendorForgotPasswordForm />
    </AuthLayout>
  );
}
