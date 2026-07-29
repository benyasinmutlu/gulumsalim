import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Üye Girişi | Gülüm Şalım" };

// Premium split-screen giriş: solda marka + atmosfer, sağda sekmeli
// (Müşteri/Satıcı) form kartı. "Satıcı Girişi" sekmesi ayrı sayfaya
// (/satici/giris) yönlendirir.
export default function LoginPage() {
  return (
    <AuthLayout
      headline={
        <>
          Tarzınıza <em>kaldığınız yerden</em> devam edin
        </>
      }
      lede="Favori ürünleriniz, siparişleriniz ve size özel önerileriniz sizi bekliyor."
      perks={[
        { icon: "fas fa-shipping-fast", label: "Hızlı ve güvenilir kargo" },
        { icon: "fas fa-undo", label: "14 gün koşulsuz iade" },
        { icon: "fas fa-shield-alt", label: "Güvenli ödeme altyapısı" },
      ]}
      tabs={[
        { label: "Müşteri Girişi", active: true },
        { label: "Satıcı Girişi", href: "/satici/giris" },
      ]}
      title="Tekrar Hoş Geldiniz"
      subtitle="Hesabınıza giriş yapın ve alışverişe devam edin."
      footer={
        <>
          Henüz üye değil misiniz? <Link href="/kayit">Hemen Kayıt Ol</Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
