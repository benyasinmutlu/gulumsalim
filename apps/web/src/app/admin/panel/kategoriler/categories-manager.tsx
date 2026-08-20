"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminCategory } from "@/lib/types";

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

export default function CategoriesManager() {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [parentId, setParentId] = useState<number | "">("");
  const [icon, setIcon] = useState("");
  const [iconColor, setIconColor] = useState("#e040a0");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function load() {
    setCategories(await fetchJson<AdminCategory[]>("/admin/categories"));
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing(null);
    setName("");
    setSlug("");
    setSlugTouched(false);
    setSortOrder((categories?.length ?? 0) * 10);
    setParentId("");
    setIcon("");
    setIconColor("#e040a0");
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");
    setError(null);
  }

  function startEdit(c: AdminCategory) {
    setEditing(c);
    setName(c.name);
    setSlug(c.slug);
    setSlugTouched(true);
    setSortOrder(c.sortOrder);
    setParentId(c.parentId ?? "");
    setIcon(c.icon ?? "");
    setIconColor(c.iconColor ?? "#e040a0");
    setSeoTitle(c.seoTitle ?? "");
    setSeoDescription(c.seoDescription ?? "");
    setSeoKeywords(c.seoKeywords ?? "");
    setError(null);
  }

  async function handleImageUpload(file: File) {
    if (!editing) return;
    setUploadingImage(true);
    try {
      const updated = await uploadFile<AdminCategory>(`/admin/categories/${editing.id}/image`, file);
      setEditing(updated);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        slug,
        sortOrder,
        parentId: parentId || null,
        icon: icon || undefined,
        iconColor: iconColor || undefined,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
        seoKeywords: seoKeywords || undefined,
      };
      if (editing) {
        await mutateJson(`/admin/categories/${editing.id}`, "PATCH", payload);
      } else {
        await mutateJson("/admin/categories", "POST", payload);
      }
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: AdminCategory) {
    await mutateJson(`/admin/categories/${c.id}`, "PATCH", { isActive: !c.isActive });
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu kategori silinsin mi?")) return;
    try {
      await mutateJson(`/admin/categories/${id}`, "DELETE");
      await load();
    } catch (err) {
      alert(err instanceof ClientApiError ? err.message : "Silinemedi");
    }
  }

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Kategoriler</h2>
        </div>
        {categories === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : categories.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-tags" />
            <h3>Henüz kategori yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Adres</th>
                  <th>Ürün</th>
                  <th>Alt Kateg.</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.parentId && <span style={{ color: "var(--admin-text-muted)" }}>↳ </span>}
                      {c.icon && (
                        <span style={{ marginRight: 4, color: c.iconColor ?? undefined }}>
                          {c.icon.startsWith("fa") ? <i className={c.icon} /> : c.icon}
                        </span>
                      )}
                      <a href="#" onClick={(e) => { e.preventDefault(); startEdit(c); }}>
                        {c.name}
                      </a>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>/kategori/{c.slug}</td>
                    <td>{c.productCount}</td>
                    <td>{c.childCount}</td>
                    <td>
                      <button
                        className={`admin-badge ${c.isActive ? "admin-badge-active" : "admin-badge-inactive"}`}
                        onClick={() => toggleActive(c)}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        {c.isActive ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(c.id)}>
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
          <h2>{editing ? `"${editing.name}" düzenleniyor` : "Yeni Kategori"}</h2>
        </div>
        <form className="admin-card-body" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Ad</label>
            <input className="admin-form-control" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Adres (/{slug || "kategori-adresi"})</label>
            <input
              className="admin-form-control"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="admin-form-group">
            <label>Üst Kategori</label>
            <select className="admin-form-control" value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Yok (ana kategori)</option>
              {categories
                ?.filter((c) => c.id !== editing?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label>İkon (emoji veya &quot;fas fa-tshirt&quot;)</label>
            <input className="admin-form-control" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="👗 veya fas fa-tshirt" maxLength={40} />
          </div>
          <div className="admin-form-group">
            <label>İkon Rengi</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="color"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                style={{ width: 44, height: 36, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }}
              />
              <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>İkon arka plan ve rengi</div>
            </div>
          </div>
          <div className="admin-form-group">
            <label>Sıra</label>
            <input className="admin-form-control" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          {editing && (
            <div className="admin-form-group">
              <label>Görsel</label>
              {editing.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.image} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, marginBottom: 8, display: "block" }} />
              )}
              <div className="admin-file-drop">
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
                <i className="fas fa-image" />
                <p>Kategori görseli</p>
                <small>PNG, JPG — 2MB max</small>
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 12, marginTop: 4 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-primary)", marginBottom: 10 }}>
              <i className="fas fa-search" /> SEO Ayarları
            </p>
            <div className="admin-form-group">
              <label>SEO Başlığı</label>
              <input className="admin-form-control" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Kategoriler - Gülüm Şalım" />
            </div>
            <div className="admin-form-group">
              <label>Meta Açıklama</label>
              <textarea className="admin-form-control" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Arama motorlarında görünecek açıklama..." />
            </div>
            <div className="admin-form-group">
              <label>Anahtar Kelimeler</label>
              <input className="admin-form-control" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="elbise, yazlık, kadın giyim" />
            </div>
          </div>
          {error && <p className="error-text" style={{ color: "var(--admin-error)" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="admin-btn admin-btn-primary" type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : editing ? "Güncelle" : "Oluştur"}
            </button>
            {editing && (
              <button type="button" className="admin-btn admin-btn-secondary" onClick={startNew}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
