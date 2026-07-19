"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { Category, VendorProduct } from "@/lib/types";

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

export default function NewProductForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<Category[]>("/categories").then(setCategories);
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Lütfen bir kategori seçin");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const product = await mutateJson<VendorProduct>("/vendor/products", "POST", {
        categoryId,
        name,
        slug,
        description: description || undefined,
        basePrice: Number(basePrice),
      });
      router.push(`/satici/panel/urunler/${product.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ürün oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Kategori
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          style={{ padding: "0.55rem 0.7rem", borderRadius: 6, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit" }}
        >
          <option value="">Seçin...</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ürün Adı
        <input required value={name} onChange={(e) => handleNameChange(e.target.value)} />
      </label>
      <label>
        Ürün Adresi
        <input
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
      </label>
      <label>
        Açıklama
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Fiyat (₺)
        <input type="number" required min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Kaydediliyor..." : "Ürünü Oluştur"}
      </button>
    </form>
  );
}
