"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson, uploadFile } from "@/lib/client-api";
import type { CustomerProfile } from "@/lib/types";

const KADIN_BEDENLER = ["XS", "S", "M", "L", "XL", "XXL"];
const AYAKKABI_NOLARI = [35, 36, 37, 38, 39, 40, 41, 42, 43];

function SizeChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 14px",
        borderRadius: 999,
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: active ? 600 : 400,
        border: active ? "1.5px solid var(--color-primary)" : "1.5px solid var(--color-border, #e0d6d9)",
        background: active ? "var(--color-primary)" : "transparent",
        color: active ? "#fff" : "var(--color-text)",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

export default function ProfileForm({ customer }: { customer: CustomerProfile }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(customer.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(customer.fullName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [age, setAge] = useState(customer.age?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(customer.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(customer.weightKg?.toString() ?? "");
  const [kadinBeden, setKadinBeden] = useState<string[]>(customer.sizePrefs?.kadinBeden ?? []);
  const [ayakkabiNo, setAyakkabiNo] = useState<number[]>(customer.sizePrefs?.ayakkabiNo ?? []);
  const [cocukBeden, setCocukBeden] = useState((customer.sizePrefs?.cocukBeden ?? []).join(", "));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updated = await uploadFile<CustomerProfile>("/auth/me/avatar", file);
      setAvatarUrl(updated.avatarUrl);
      router.refresh();
    } catch (err) {
      setAvatarError(err instanceof ClientApiError ? err.message : "Fotoğraf yüklenemedi");
    } finally {
      setAvatarUploading(false);
    }
  }

  function toggleKadin(size: string) {
    setKadinBeden((previous) => previous.includes(size) ? previous.filter((value) => value !== size) : [...previous, size]);
  }

  function toggleAyakkabi(size: number) {
    setAyakkabiNo((previous) => previous.includes(size) ? previous.filter((value) => value !== size) : [...previous, size]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const cocuk = cocukBeden.split(",").map((value) => value.trim()).filter(Boolean);
      await mutateJson("/auth/me", "PATCH", {
        fullName,
        phone: phone || undefined,
        age: age || undefined,
        heightCm: heightCm || undefined,
        weightKg: weightKg || undefined,
        sizePrefs: {
          kadinBeden: kadinBeden.length ? kadinBeden : undefined,
          ayakkabiNo: ayakkabiNo.length ? ayakkabiNo : undefined,
          cocukBeden: cocuk.length ? cocuk : undefined,
        },
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

      <div className="avatar-upload">
        <div className="avatar-upload-preview">
          {/* Avatar data/blob/S3 URL olabilir; sabit Next Image host listesine uygun değildir. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{fullName.trim().charAt(0).toUpperCase() || "?"}</span>}
        </div>
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
          >
            {avatarUploading ? "Yükleniyor..." : "Fotoğrafı Değiştir"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
          {avatarError && <p className="error-text" style={{ marginTop: 6 }}>{avatarError}</p>}
        </div>
      </div>

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

      <h3 style={{ marginTop: "1.5rem" }}>
        <i className="fas fa-ruler" /> Beden Tercihlerim
      </h3>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text-light)", marginTop: "-0.5rem", marginBottom: "1rem" }}>
        Bedenlerini seç; mağazada <strong>&quot;Bedenime Uygun&quot;</strong> filtresi stoktaki uygun ürünleri öne çıkarsın.
      </p>

      <div className="form-group">
        <label>Kadın Beden</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {KADIN_BEDENLER.map((size) => (
            <SizeChip key={size} label={size} active={kadinBeden.includes(size)} onClick={() => toggleKadin(size)} />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Ayakkabı Numarası</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AYAKKABI_NOLARI.map((size) => (
            <SizeChip key={size} label={String(size)} active={ayakkabiNo.includes(size)} onClick={() => toggleAyakkabi(size)} />
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Çocuk Beden (opsiyonel)</label>
        <input
          className="form-control"
          value={cocukBeden}
          onChange={(event) => setCocukBeden(event.target.value)}
          placeholder="ör. 5-6 yaş, 7-8 yaş, 104"
        />
      </div>

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
