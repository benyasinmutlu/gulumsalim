import Link from "next/link";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import VendorLoginForm from "./login-form";

export const metadata: Metadata = { title: "Satıcı Girişi | Gülüm Şalım" };

export default function VendorLoginPage() {
  return (
    <AuthLayout
      headline={
        <>
          Mağazanızı <em>yönetmeye</em> devam edin
        </>
      }
      lede="Satıcı panelinizden ürünlerinizi, siparişlerinizi ve kazançlarınızı takip edin."
      perks={[
        { icon: "fas fa-store", label: "Binlerce alıcıya anında ulaş" },
        { icon: "fas fa-bolt", label: "Dakikalar içinde kurulan satıcı paneli" },
        { icon: "fas fa-wallet", label: "Hızlı ve güvenli ödeme akışı" },
      ]}
      tabs={[
        { label: "Müşteri Girişi", href: "/giris" },
        { label: "Satıcı Girişi", active: true },
      ]}
      title="Satıcı Girişi"
      subtitle="Satıcı panelinize erişmek için giriş yapın."
      footer={
        <>
          Henüz satıcı değil misiniz? <Link href="/satici/kayit">Ücretsiz Başvurun</Link>
        </>
      }
    >
      <VendorLoginForm />
    </AuthLayout>
  );
}
