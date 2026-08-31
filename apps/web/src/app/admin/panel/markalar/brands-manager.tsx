"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminBrand } from "@/lib/types";

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

// bkz. denetim raporu: "Marka yönetimi" - kategoriler modülüyle aynı basit
// CRUD deseni (bkz. categories-manager.tsx). products.brand serbest metin
// olarak KALIYOR - bu liste satıcı formundaki Marka alanına öneri
// (datalist) sağlamak için, mevcut ürünleri geriye dönük değiştirmiyor.
export default function BrandsManager() {
  const [brands, setBrands] = useState<AdminBrand[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setBrands(await fetchJson<AdminBrand[]>("/admin/brands"));
  }

  useEffect(() => {
    load();
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await mutateJson("/admin/brands", "POST", { name, slug });
      setName("");
      setSlug("");
      setSlugTouched(false);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: AdminBrand) {
    await mutateJson(`/admin/brands/${b.id}`, "PATCH", { isActive: !b.isActive });
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu marka silinsin mi?")) return;
    try {
      await mutateJson(`/admin/brands/${id}`, "DELETE");
      await load();
    } catch (err) {
      alert(err instanceof ClientApiError ? err.message : "Silinemedi");
    }
  }

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Markalar</h2>
        </div>
        {brands === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : brands.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-tags" />
            <h3>Henüz marka eklenmedi</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Adres</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>{b.slug}</td>
                    <td>
                      <button type="button" className={`st st-${b.isActive ? "success" : "muted"}`} onClick={() => toggleActive(b)}>
                        {b.isActive ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Yeni Marka</h2>
        </div>
        <form className="fc" style={{ padding: 20 }} onSubmit={handleSubmit}>
          <div className="fg">
            <label>Marka Adı</label>
            <input className="fi" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div className="fg">
            <label>Marka Adresi</label>
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
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" type="submit" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Marka Ekle"}
          </button>
        </form>
      </div>
    </div>
  );
}
