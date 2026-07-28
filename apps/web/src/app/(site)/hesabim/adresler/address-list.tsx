"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerAddress } from "@/lib/types";
import AddressForm from "./address-form";

export default function AddressList({ addresses }: { addresses: CustomerAddress[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: number) {
    if (!window.confirm("Bu adresi silmek istediğinize emin misiniz?")) return;
    try {
      await mutateJson(`/addresses/${id}`, "DELETE");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Adres silinemedi");
    }
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      {addresses.map((addr) =>
        editingId === addr.id ? (
          <AddressForm key={addr.id} address={addr} onDone={() => setEditingId(null)} />
        ) : (
          <div key={addr.id} className="detail-vendor" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
              <strong>
                {addr.fullName} {addr.isDefault && <span className="badge badge-new">VARSAYILAN</span>}
              </strong>
            </div>
            <div style={{ fontSize: "0.85rem" }}>{addr.phone}</div>
            <div style={{ fontSize: "0.85rem" }}>
              {addr.addressLine}, {addr.district} / {addr.city} {addr.zipCode ?? ""}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: 6 }}>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditingId(addr.id)}>
                Düzenle
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => handleDelete(addr.id)}>
                Sil
              </button>
            </div>
          </div>
        ),
      )}

      {creating ? (
        <AddressForm onDone={() => setCreating(false)} />
      ) : (
        <button className="btn btn-sm" type="button" onClick={() => setCreating(true)} style={{ marginTop: "1rem" }}>
          <i className="fas fa-plus" /> Yeni Adres Ekle
        </button>
      )}
    </div>
  );
}
