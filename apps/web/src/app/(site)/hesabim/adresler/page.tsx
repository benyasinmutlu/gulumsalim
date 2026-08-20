import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerAddress } from "@/lib/types";
import AddressList from "./address-list";

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
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-map-marker-alt" />
        </div>
        <div>
          <h3>Adreslerim</h3>
          <div className="account-page-subtitle">{addresses.length > 0 ? `${addresses.length} kayıtlı adres` : "Teslimat adresleriniz"}</div>
        </div>
      </div>
      <div className="form-card">
        <AddressList addresses={addresses} />
      </div>
    </>
  );
}
