"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const [brand, setBrand] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJson<Category[]>("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    if (addingCategory) newCategoryInputRef.current?.focus();
  }, [addingCategory]);

  // bkz. kullanıcı isteği: "satıcı panelinde ürün eklemede kategori
  // eklemede olsun ve bu şekilde kategori çeşitliliğimiz artar" - ürün
  // ekleme akışından hiç çıkmadan yeni bir kategori oluşturulabilir.
  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    setCategoryError(null);
    try {
      const category = await mutateJson<Category>("/vendor/categories", "POST", { name: newCategoryName.trim() });
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name, "tr")));
      setCategoryId(category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      setCategoryError(err instanceof ClientApiError ? err.message : "Kategori oluşturulamadı");
    } finally {
      setCreatingCategory(false);
    }
  }

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
        brand: brand || undefined,
        basePrice: Number(basePrice),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
      });
      router.push(`/satici/panel/urunler/${product.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ürün oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Yeni Ürün</h3>
      </div>
      <form className="fc" style={{ padding: "20px" }} onSubmit={handleSubmit}>
        <div className="fg">
          <label>Kategori</label>
          {!addingCategory ? (
            <div style={{ display: "flex", gap: 8 }}>
              <select className="fi" required value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} style={{ flex: 1 }}>
                <option value="">Seçin...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sec btn-sm" onClick={() => setAddingCategory(true)} title="Yeni kategori ekle">
                <i className="fas fa-plus" /> Yeni
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={newCategoryInputRef}
                className="fi"
                placeholder="Yeni kategori adı"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-pr btn-sm" onClick={handleCreateCategory} disabled={creatingCategory}>
                {creatingCategory ? "..." : "Ekle"}
              </button>
              <button
                type="button"
                className="btn btn-sec btn-sm"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                  setCategoryError(null);
                }}
              >
                Vazgeç
              </button>
            </div>
          )}
          {categoryError && <p style={{ color: "var(--er)", fontSize: "0.8rem", marginTop: 4 }}>{categoryError}</p>}
        </div>
        <div className="fg">
          <label>Ürün Adı</label>
          <input className="fi" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
        <div className="fg">
          <label>Ürün Adresi</label>
          <input
            className="fi"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div className="fg">
          <label>Açıklama</label>
          <input className="fi" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="fg">
          <label>Marka</label>
          <input className="fi" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
        </div>
        <div className="fg">
          <label>Fiyat (₺)</label>
          <input className="fi" type="number" required min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </div>
        <div className="fg">
          <label>İndirimli Fiyat (₺)</label>
          <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
        </div>
        {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
        <button className="btn btn-pr" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
          {loading ? "Kaydediliyor..." : "Ürünü Oluştur"}
        </button>
      </form>
    </div>
  );
}
