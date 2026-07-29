import Link from "next/link";
import type { Metadata } from "next";
import AuthLayout from "@/components/auth/AuthLayout";
import VendorRegisterForm from "./register-form";

export const metadata: Metadata = { title: "Satıcı Kayıt Ol | Gülüm Şalım" };

export default function VendorRegisterPage() {
  return (
    <AuthLayout
      headline={
        <>
          Milyonlarca müşteriye <em>ulaşın</em>
        </>
      }
      lede='Kayıt sonrası mağazanız "onay bekliyor" durumunda oluşturulur — ürünleriniz admin onayından sonra yayınlanır.'
      perks={[
        { icon: "fas fa-store", label: "Binlerce alıcıya anında ulaş" },
        { icon: "fas fa-bolt", label: "Dakikalar içinde kurulan satıcı paneli" },
        { icon: "fas fa-wallet", label: "Hızlı ve güvenli ödeme akışı" },
      ]}
      tabs={[
        { label: "Müşteri Kaydı", href: "/kayit" },
        { label: "Satıcı Kaydı", active: true },
      ]}
      title="Satıcı Olun"
      subtitle="Milyonlarca müşteriye ulaşmak için bugün başvurun."
      footer={
        <>
          Zaten satıcı mısınız? <Link href="/satici/giris">Giriş Yapın</Link>
        </>
      }
    >
      <VendorRegisterForm />
    </AuthLayout>
  );
}
