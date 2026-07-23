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
    <div className="form-card">
      <h3>Adreslerim</h3>
      {addresses.length === 0 && <p style={{ fontSize: "0.9rem" }}>Henüz kayıtlı adresiniz yok.</p>}
      <AddressList addresses={addresses} />
    </div>
  );
}
