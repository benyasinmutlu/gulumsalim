"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerAddress } from "@/lib/types";

interface Props {
  address?: CustomerAddress;
  onDone: () => void;
}

export default function AddressForm({ address, onDone }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(address?.fullName ?? "");
  const [phone, setPhone] = useState(address?.phone ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [district, setDistrict] = useState(address?.district ?? "");
  const [addressLine, setAddressLine] = useState(address?.addressLine ?? "");
  const [zipCode, setZipCode] = useState(address?.zipCode ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const body = { fullName, phone, city, district, addressLine, zipCode: zipCode || undefined, isDefault };
    try {
      if (address) {
        await mutateJson(`/addresses/${address.id}`, "PATCH", body);
      } else {
        await mutateJson("/addresses", "POST", body);
      }
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Adres kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
      <div className="form-group">
        <label>Ad Soyad</label>
        <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Telefon</label>
        <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>İl</label>
        <input className="form-control" value={city} onChange={(e) => setCity(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>İlçe</label>
        <input className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Adres</label>
        <textarea
          className="form-control"
          rows={3}
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label>Posta Kodu</label>
        <input className="form-control" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
      </div>
      <div className="form-group">
        <label>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> Varsayılan
          adresim
        </label>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button className="btn btn-sm" type="submit" disabled={loading}>
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onDone}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
