import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerAddress } from "@/lib/types";
import AddressList from "./address-list";
import AccountPageHeader from "@/components/account-page-header";

export const metadata: Metadata = { title: "Adreslerim | Gülüm Şalım" };

async function getAddresses(): Promise<CustomerAddress[]> {
  try {
    return await apiFetchJson<CustomerAddress[]>("/addresses");
  } catch {
    return [];
  }
}

export default async function CustomerAddressesPage() {
  const addresses = await getAddresses();

  return (
    <>
      <AccountPageHeader
        icon="fa-map-marker-alt"
        title="Adreslerim"
        subtitle={addresses.length > 0 ? `${addresses.length} kayıtlı adres` : "Teslimat adresleriniz"}
      />
      <div className="form-card">
        <AddressList addresses={addresses} />
      </div>
    </>
  );
}
