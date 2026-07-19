"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function VendorRegisterForm() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleStoreNameChange(value: string) {
    setStoreName(value);
    if (!slugTouched) setStoreSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson<VendorProfile>("/vendor/auth/register", "POST", {
        storeName,
        storeSlug,
        fullName,
        email,
        password,
      });
      router.push("/satici/panel");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kayıt başarısız oldu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Mağaza Adı
        <input required value={storeName} onChange={(e) => handleStoreNameChange(e.target.value)} />
      </label>
      <label>
        Mağaza Adresi (gulumsalim.com/{storeSlug || "magaza-adiniz"})
        <input
          required
          value={storeSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setStoreSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label>
        Yetkili Ad Soyad
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label>
        E-posta
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Şifre (en az 8 karakter)
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Satıcı Ol"}
      </button>
    </form>
  );
}
