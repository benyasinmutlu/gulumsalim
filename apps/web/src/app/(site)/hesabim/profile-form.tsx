"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";

export default function ProfileForm({ customer }: { customer: CustomerProfile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(customer.fullName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [age, setAge] = useState(customer.age?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(customer.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(customer.weightKg?.toString() ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await mutateJson("/auth/me", "PATCH", {
        fullName,
        phone: phone || undefined,
        age: age || undefined,
        heightCm: heightCm || undefined,
        weightKg: weightKg || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setMessage("Profil bilgileriniz güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Güncelleme başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3>Profil Bilgilerim</h3>
      <div className="form-group">
        <label>Ad Soyad</label>
        <input className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>E-Posta Adresi</label>
        <div>{customer.email}</div>
      </div>
      <div className="form-group">
        <label>Telefon</label>
        <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXXX" />
      </div>

      <div className="form-row-3">
        <div className="form-group">
          <label>Yaş</label>
          <input className="form-control" type="number" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Boy (cm)</label>
          <input className="form-control" type="number" min={100} max={230} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Kilo (kg)</label>
          <input className="form-control" type="number" min={30} max={250} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text-light)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Size en uygun bedeni önerebilmemiz için (opsiyonel).
      </p>

      <h3 style={{ marginTop: "1.5rem" }}>Şifre Değiştir</h3>
      <div className="form-group">
        <label>Mevcut Şifre</label>
        <input
          className="form-control"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label>Yeni Şifre</label>
        <input className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: "0.9rem", color: "var(--color-success)" }}>{message}</p>}

      <button className="btn btn-sm" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
