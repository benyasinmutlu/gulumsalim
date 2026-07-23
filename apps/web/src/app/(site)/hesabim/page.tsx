import { apiFetchJson } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import ProfileForm from "./profile-form";
import CustomerLogoutButton from "./logout-button";

async function getCustomer(): Promise<CustomerProfile> {
  return apiFetchJson<CustomerProfile>("/auth/me");
}

export default async function AccountPage() {
  const customer = await getCustomer();

  return (
    <>
      <ProfileForm customer={customer} />
      <div style={{ marginTop: "1rem" }}>
        <CustomerLogoutButton />
      </div>
    </>
  );
}
