"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminHomepageCollection, AdminProductRow, HomepageCollectionProductRow } from "@/lib/types";

const LINK_TYPE_OPTIONS = [
  { value: "", label: "Yok" },
  { value: "category", label: "Kategori" },
  { value: "vendor", label: "Mağaza" },
  { value: "all_vendors", label: "Tüm Mağazalar" },
  { value: "collection", label: "Koleksiyon" },
  { value: "url", label: "Özel Adres" },
] as const;

// gulumsalim.com'daki admin/homepage-collections.php'nin karşılığı -
// admin'in herhangi bir satıcıdan elle ürün seçerek kurduğu anasayfa
// vitrinleri (algoritmik homepage_sections'tan farklı).
export default function CollectionsManager() {
  const [collections, setCollections] = useState<AdminHomepageCollection[] | null>(null);
  const [editing, setEditing] = useState<AdminHomepageCollection | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textColor, setTextColor] = useState("");
  const [linkType, setLinkType] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<HomepageCollectionProductRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AdminProductRow[]>([]);

  async function load() {
    setCollections(await fetchJson<AdminHomepageCollection[]>("/admin/homepage-collections"));
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing(null);
    setTitle("");
    setSubtitle("");
    setTextColor("");
    setLinkType("");
    setLinkValue("");
    setProducts(null);
    setError(null);
  }

  async function startEdit(col: AdminHomepageCollection) {
    setEditing(col);
    setTitle(col.title);
    setSubtitle(col.subtitle ?? "");
    setTextColor(col.textColor ?? "");
    setLinkType(col.linkType ?? "");
    setLinkValue(col.linkValue ?? "");
    setError(null);
    setProducts(await fetchJson<HomepageCollectionProductRow[]>(`/admin/homepage-collections/${col.id}/products`));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const body = {
      title,
      subtitle: subtitle || undefined,
      textColor: textColor || undefined,
      linkType: linkType || undefined,
      linkValue: linkValue || undefined,
    };
    try {
      if (editing) {
        await mutateJson(`/admin/homepage-collections/${editing.id}`, "PATCH", body);
      } else {
        await mutateJson("/admin/homepage-collections", "POST", body);
      }
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(col: AdminHomepageCollection) {
    await mutateJson(`/admin/homepage-collections/${col.id}`, "PATCH", { isActive: !col.isActive });
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu koleksiyon silinsin mi?")) return;
    await mutateJson(`/admin/homepage-collections/${id}`, "DELETE");
    if (editing?.id === id) startNew();
    await load();
  }

  async function runSearch() {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetchJson<{ items: AdminProductRow[] }>(`/admin/products?status=active&search=${encodeURIComponent(search.trim())}`);
    setSearchResults(res.items);
  }

  async function addProduct(productId: number) {
    if (!editing) return;
    await mutateJson(`/admin/homepage-collections/${editing.id}/products`, "POST", { productId });
    setProducts(await fetchJson<HomepageCollectionProductRow[]>(`/admin/homepage-collections/${editing.id}/products`));
  }

  async function removeProduct(productId: number) {
    if (!editing) return;
    await mutateJson(`/admin/homepage-collections/${editing.id}/products/${productId}`, "DELETE");
    setProducts(await fetchJson<HomepageCollectionProductRow[]>(`/admin/homepage-collections/${editing.id}/products`));
  }

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Anasayfa Koleksiyonları</h2>
        </div>
        {collections === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : collections.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-layer-group" />
            <h3>Henüz koleksiyon yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          startEdit(c);
                        }}
                      >
                        {c.title}
                      </a>
                    </td>
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

      <div>
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>{editing ? `"${editing.title}" düzenleniyor` : "Yeni Koleksiyon"}</h2>
          </div>
          <form className="admin-card-body" onSubmit={handleSubmit}>
            <div className="admin-form-group">
              <label>Başlık</label>
              <input className="admin-form-control" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label>Alt Başlık</label>
              <input className="admin-form-control" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Başlık Rengi</label>
                <input type="color" className="admin-form-control" value={textColor || "#1a1a2e"} onChange={(e) => setTextColor(e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>"Tümünü Gör" Hedefi</label>
                <select className="admin-form-control" value={linkType} onChange={(e) => setLinkType(e.target.value)}>
                  {LINK_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {linkType && linkType !== "all_vendors" && (
              <div className="admin-form-group">
                <label>
                  {linkType === "category"
                    ? "Kategori Slug"
                    : linkType === "vendor"
                      ? "Mağaza Slug"
                      : linkType === "collection"
                        ? "Mağaza Slug/Koleksiyon Slug (ör. bulteen-2/yaz-kreasyonu)"
                        : "Adres (/urunler gibi)"}
                </label>
                <input className="admin-form-control" value={linkValue} onChange={(e) => setLinkValue(e.target.value)} />
              </div>
            )}
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

        {editing && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h2>Ürünler</h2>
            </div>
            <div className="admin-card-body">
              <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}>
                <input
                  className="admin-form-control"
                  placeholder="Ürün ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                />
                <button type="button" className="admin-btn admin-btn-secondary" onClick={runSearch}>
                  Ara
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ marginBottom: "1rem", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "0.5rem" }}>
                  {searchResults.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0" }}>
                      <span style={{ fontSize: "0.85rem" }}>
                        {p.name} <span style={{ color: "var(--admin-text-muted)" }}>({p.vendorStoreName})</span>
                      </span>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => addProduct(p.id)}>
                        Ekle
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {products === null ? (
                <div>Yükleniyor...</div>
              ) : products.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Bu koleksiyonda henüz ürün yok.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ürün</th>
                      <th>Fiyat</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.membershipId}>
                        <td>{p.name}</td>
                        <td>{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                        <td style={{ textAlign: "right" }}>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeProduct(p.id)}>
                            Kaldır
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
