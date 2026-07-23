"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorCollection, VendorCollectionProduct, VendorProduct, VendorProfile } from "@/lib/types";

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

export default function CollectionsManager() {
  const [collections, setCollections] = useState<VendorCollection[] | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<VendorCollection | null>(null);
  const [collectionProducts, setCollectionProducts] = useState<VendorCollectionProduct[]>([]);
  const [addProductId, setAddProductId] = useState<number | "">("");

  const [editing, setEditing] = useState<VendorCollection | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDescription, setEditSeoDescription] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setCollections(await fetchJson<VendorCollection[]>("/vendor/collections"));
  }

  useEffect(() => {
    load();
    fetchJson<VendorProduct[]>("/vendor/products").then(setProducts);
    fetchJson<VendorProfile>("/vendor/auth/me").then((v) => setStoreSlug(v.storeSlug));
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/vendor/collections", "POST", { name, slug, description: description || undefined });
      setName("");
      setSlug("");
      setDescription("");
      setSlugTouched(false);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: VendorCollection) {
    await mutateJson(`/vendor/collections/${c.id}`, "PATCH", { isActive: !c.isActive });
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu koleksiyon silinsin mi?")) return;
    await mutateJson(`/vendor/collections/${id}`, "DELETE");
    if (selected?.id === id) setSelected(null);
    if (editing?.id === id) setEditing(null);
    await load();
  }

  async function openCollection(c: VendorCollection) {
    setSelected(c);
    setCollectionProducts(await fetchJson<VendorCollectionProduct[]>(`/vendor/collections/${c.id}/products`));
  }

  function startEdit(c: VendorCollection) {
    setEditing(c);
    setEditName(c.name);
    setEditDescription(c.description ?? "");
    setEditSortOrder(c.sortOrder);
    setEditSeoTitle(c.seoTitle ?? "");
    setEditSeoDescription(c.seoDescription ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    await mutateJson(`/vendor/collections/${editing.id}`, "PATCH", {
      name: editName,
      description: editDescription || undefined,
      sortOrder: editSortOrder,
      seoTitle: editSeoTitle || undefined,
      seoDescription: editSeoDescription || undefined,
    });
    setEditing(null);
    await load();
  }

  async function handleImageUpload() {
    if (!editing) return;
    const file = imageInputRef.current?.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const updated = await uploadFile<VendorCollection>(`/vendor/collections/${editing.id}/image`, file);
      setEditing(updated);
      if (imageInputRef.current) imageInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploadingImage(false);
    }
  }

  async function addProduct() {
    if (!selected || !addProductId) return;
    await mutateJson(`/vendor/collections/${selected.id}/products`, "POST", { productId: addProductId });
    setCollectionProducts(await fetchJson<VendorCollectionProduct[]>(`/vendor/collections/${selected.id}/products`));
    setAddProductId("");
  }

  async function removeProduct(productId: number) {
    if (!selected) return;
    await mutateJson(`/vendor/collections/${selected.id}/products/${productId}`, "DELETE");
    setCollectionProducts(await fetchJson<VendorCollectionProduct[]>(`/vendor/collections/${selected.id}/products`));
  }

  async function moveProduct(productId: number, direction: "up" | "down") {
    if (!selected) return;
    setCollectionProducts(
      await mutateJson<VendorCollectionProduct[]>(`/vendor/collections/${selected.id}/products/${productId}/move`, "POST", { direction }),
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch">
          <h3>Yeni Koleksiyon</h3>
        </div>
        <form className="fc" style={{ padding: "20px" }} onSubmit={handleSubmit}>
          <div className="row3" style={{ alignItems: "flex-end" }}>
            <div className="fg">
              <label>Ad</label>
              <input className="fi" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div className="fg">
              <label>Adres (/{slug || "koleksiyon-adi"})</label>
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
              <textarea className="fi" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa açıklama (isteğe bağlı)" />
            </div>
          </div>
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch">
          <h3>Koleksiyonlarım</h3>
        </div>
        {collections === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : collections.length === 0 ? (
          <div className="empty">
            <i className="fas fa-layer-group" />
            <p>Henüz koleksiyon oluşturmadınız.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Ad</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverImage} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className="fas fa-image" style={{ color: "var(--tx3)", fontSize: 12 }} />
                        </div>
                      )}
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); openCollection(c); }}>
                        {c.name}
                      </a>
                    </td>
                    <td>
                      <span className={`st ${c.isActive ? "st-success" : "st-muted"}`} style={{ cursor: "pointer" }} onClick={() => toggleActive(c)}>
                        {c.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {storeSlug && (
                          <a
                            href={`/${storeSlug}/koleksiyon/${c.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sec btn-sm"
                            title="Koleksiyon sayfasını canlı görüntüle"
                          >
                            <i className="fas fa-eye" />
                          </a>
                        )}
                        <button className="btn btn-sec btn-sm" onClick={() => startEdit(c)}>
                          Düzenle
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <h3>&quot;{editing.name}&quot; Düzenle</h3>
          </div>
          <div className="card-body fc">
            <div className="fg">
              <label>Kapak Görseli</label>
              {editing.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editing.coverImage} alt="" style={{ width: "100%", maxWidth: 260, height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />
              )}
              <div className="file-drop">
                <input ref={imageInputRef} type="file" accept="image/*" disabled={uploadingImage} onChange={handleImageUpload} />
                <i className="fas fa-image" />
                <p>{uploadingImage ? "Yükleniyor..." : "Kapak görseli seç"}</p>
              </div>
            </div>
            <div className="row2">
              <div className="fg">
                <label>Ad</label>
                <input className="fi" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="fg">
                <label>Sıra</label>
                <input className="fi" type="number" value={editSortOrder} onChange={(e) => setEditSortOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="fg">
              <label>Açıklama</label>
              <textarea className="fi" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div style={{ borderTop: "1px solid var(--br)", paddingTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pr)", marginBottom: 10 }}>
                <i className="fas fa-search" /> SEO Ayarları
              </p>
              <div className="fc">
                <div className="fg">
                  <label>SEO Başlığı</label>
                  <input className="fi" value={editSeoTitle} onChange={(e) => setEditSeoTitle(e.target.value)} />
                </div>
                <div className="fg">
                  <label>Meta Açıklama</label>
                  <textarea className="fi" value={editSeoDescription} onChange={(e) => setEditSeoDescription(e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-pr" onClick={saveEdit}>
                Kaydet
              </button>
              <button className="btn btn-sec" onClick={() => setEditing(null)}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="ch">
            <h3>&quot;{selected.name}&quot; Ürünleri</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <select className="fi" value={addProductId} onChange={(e) => setAddProductId(Number(e.target.value))}>
                <option value="">Ürün seç...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-pr btn-sm" onClick={addProduct}>
                Ekle
              </button>
            </div>
            {collectionProducts.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Bu koleksiyonda henüz ürün yok.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {collectionProducts.map((p, i) => (
                  <div key={p.id} style={{ width: 140 }}>
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" width={140} height={140} style={{ objectFit: "cover", borderRadius: 8 }} />
                    )}
                    <div style={{ fontSize: 12, marginTop: 4 }}>{p.name}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                      <button
                        className="btn btn-sec btn-sm"
                        style={{ flex: 1 }}
                        disabled={i === 0}
                        title="Yukarı taşı"
                        onClick={() => moveProduct(p.productId, "up")}
                      >
                        <i className="fas fa-arrow-up" />
                      </button>
                      <button
                        className="btn btn-sec btn-sm"
                        style={{ flex: 1 }}
                        disabled={i === collectionProducts.length - 1}
                        title="Aşağı taşı"
                        onClick={() => moveProduct(p.productId, "down")}
                      >
                        <i className="fas fa-arrow-down" />
                      </button>
                    </div>
                    <button className="btn btn-danger btn-sm" style={{ width: "100%", marginTop: 4 }} onClick={() => removeProduct(p.productId)}>
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
