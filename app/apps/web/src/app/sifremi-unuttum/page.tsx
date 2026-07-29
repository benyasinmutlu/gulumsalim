import Link from "next/link";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import ForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = { title: "Şifremi Unuttum | Gülüm Şalım" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      backHref="/giris"
      backLabel="Girişe Dön"
      headline={
        <>
          Şifrenizi mi <em>unuttunuz?</em>
        </>
      }
      lede="Endişelenmeyin, e-posta adresinize birkaç dakika içinde bir sıfırlama bağlantısı gönderelim."
      title="Şifremi Unuttum"
      subtitle="Hesabınıza kayıtlı e-posta adresini girin."
      footer={
        <>
          Şifrenizi hatırladınız mı? <Link href="/giris">Giriş Yap</Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
