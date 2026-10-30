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

      {addresses.length === 0 && !creating && (
        <div className="account-empty-state account-empty-state-compact">
          <i className="fas fa-map-marker-alt" />
          <p>Henüz kayıtlı adresiniz yok.</p>
        </div>
      )}

      {addresses.map((addr) =>
        editingId === addr.id ? (
          <AddressForm key={addr.id} address={addr} onDone={() => setEditingId(null)} />
        ) : (
          <div key={addr.id} className="address-card">
            <div className="address-card-head">
              <strong>
                {addr.fullName} {addr.isDefault && <span className="badge badge-new">VARSAYILAN</span>}
              </strong>
            </div>
            <div className="address-card-line">{addr.phone}</div>
            <div className="address-card-line">
              {addr.addressLine}, {addr.district} / {addr.city} {addr.zipCode ?? ""}
            </div>
            <div className="address-card-actions">
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
        <button className="btn btn-sm address-add-btn" type="button" onClick={() => setCreating(true)}>
          <i className="fas fa-plus" /> Yeni Adres Ekle
        </button>
      )}
    </div>
  );
}
