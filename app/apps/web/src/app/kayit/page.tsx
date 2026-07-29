import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import RegisterForm from "./register-form";

export const metadata: Metadata = { title: "Üye Kayıt Ol | Gülüm Şalım" };

// Premium split-screen kayıt. Satıcı kaydı ayrı sayfada (/satici/kayit)
// olduğu için "Satıcı Kaydı" sekmesi oraya yönlendirir.
export default function RegisterPage() {
  return (
    <AuthLayout
      headline={
        <>
          Ailemize katılın, <em>tarzınızı</em> keşfedin
        </>
      }
      lede="Üye olun; favori ürünleriniz, sipariş takibiniz ve size özel önerileriniz burada."
      perks={[
        { icon: "fas fa-shipping-fast", label: "Hızlı ve güvenilir kargo" },
        { icon: "fas fa-undo", label: "14 gün koşulsuz iade" },
        { icon: "fas fa-shield-alt", label: "Güvenli ödeme altyapısı" },
      ]}
      tabs={[
        { label: "Müşteri Kaydı", active: true },
        { label: "Satıcı Kaydı", href: "/satici/kayit" },
      ]}
      title="Hesap Oluştur"
      subtitle="Üye olarak sipariş takibinizi kolayca yapın, indirimlerden ilk siz haberdar olun."
      footer={
        <>
          Zaten üye misiniz? <Link href="/giris">Giriş Yap</Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthLayout>
  );
}
