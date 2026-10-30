import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import ProfileForm from "./profile-form";
import CustomerLogoutButton from "./logout-button";
import DeleteAccountButton from "./delete-account-button";
import AccountPageHeader from "@/components/account-page-header";

export const metadata: Metadata = { title: "Hesabım | Gülüm Şalım" };

async function getCustomer(): Promise<CustomerProfile> {
  return apiFetchJson<CustomerProfile>("/auth/me");
}

export default async function AccountPage() {
  const customer = await getCustomer();

  return (
    <>
      <AccountPageHeader
        icon="fa-user-edit"
        title="Profil Bilgilerim"
        subtitle={`Merhaba, ${customer.fullName.split(" ")[0]}`}
      />
      <ProfileForm customer={customer} />
      <div className="account-actions-row">
        <CustomerLogoutButton />
        <DeleteAccountButton />
      </div>
    </>
  );
}
