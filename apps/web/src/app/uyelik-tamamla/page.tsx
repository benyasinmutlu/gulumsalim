import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import CompleteConsentForm from "./complete-consent-form";

export const metadata: Metadata = { title: "Üyeliği Tamamla | Gülüm Şalım" };

async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

// bkz. kullanıcı isteği: "google ile giriş yap a tıklayınca direkt kayıt
// yapılsın eksik bilgileri giriş yapınca tamamlatalım" - Google ile anında
// açılan hesap buraya düşer (bkz. google-signin-button.tsx). Zaten
// tamamlamış (needsConsent false) ya da hiç giriş yapmamış biri buraya
// doğrudan gelirse anlamsız - ikisi de yönlendirilir.
export default async function CompleteConsentPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/giris");
  if (!customer.needsConsent) redirect("/");

  return (
    <>
      <div className="ga-wrap">
        <div className="ga-visual">
          <div className="ga-orb ga-orb1" />
          <div className="ga-orb ga-orb2" />
          <div className="ga-visual-inner">
            <Link href="/" className="ga-brand">
              <div className="ga-brand-icon">GS</div>
              <div className="ga-brand-name">Gülüm Şalım</div>
            </Link>
            <h1>Neredeyse tamam!</h1>
            <p>Google hesabınla giriş yaptın. Devam etmeden önce son bir adım kaldı.</p>
          </div>
        </div>

        <div className="ga-panel">
          <div className="ga-card">
            <h2>Hoş geldin, {customer.fullName.split(" ")[0]}</h2>
            <p className="ga-sub">Üyeliğini tamamlamak için aşağıdaki onayı vermen gerekiyor.</p>

            <CompleteConsentForm />
          </div>
        </div>
      </div>
    </>
  );
}
