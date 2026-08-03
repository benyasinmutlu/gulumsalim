import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import ProfileForm from "./profile-form";
import CustomerLogoutButton from "./logout-button";
import DeleteAccountButton from "./delete-account-button";

export const metadata: Metadata = { title: "Hesabım | Gülüm Şalım" };

async function getCustomer(): Promise<CustomerProfile> {
  return apiFetchJson<CustomerProfile>("/auth/me");
}

export default async function AccountPage() {
  const customer = await getCustomer();

  return (
    <>
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-user-edit" />
        </div>
        <div>
          <h3>Profil Bilgilerim</h3>
          <div className="account-page-subtitle">Merhaba, {customer.fullName.split(" ")[0]} 👋</div>
        </div>
      </div>
      <ProfileForm customer={customer} />
      <div style={{ marginTop: "1rem" }}>
        <CustomerLogoutButton />
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <DeleteAccountButton />
      </div>
    </>
  );
}
