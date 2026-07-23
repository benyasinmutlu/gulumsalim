"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorCollection, VendorCollectionProduct, VendorProduct } from "@/lib/types";

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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<VendorCollection | null>(null);
  const [collectionProducts, setCollectionProducts] = useState<VendorCollectionProduct[]>([]);
  const [addProductId, setAddProductId] = useState<number | "">("");

  async function load() {
    setCollections(await fetchJson<VendorCollection[]>("/vendor/collections"));
  }

  useEffect(() => {
    load();
    fetchJson<VendorProduct[]>("/vendor/products").then(setProducts);
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
      await mutateJson("/vendor/collections", "POST", { name, slug });
      setName("");
      setSlug("");
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
    await load();
  }

  async function openCollection(c: VendorCollection) {
    setSelected(c);
    setCollectionProducts(await fetchJson<VendorCollectionProduct[]>(`/vendor/collections/${c.id}/products`));
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

  return (
    <div>
      <div className="card">
        <div className="ch">
          <h3>Yeni Koleksiyon</h3>
        </div>
        <form className="row2" style={{ padding: "20px", alignItems: "flex-end" }} onSubmit={handleSubmit}>
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
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </form>
      </div>

      <div className="card">
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
                  <th>Ad</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id}>
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
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
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
                {collectionProducts.map((p) => (
                  <div key={p.id} style={{ width: 140 }}>
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" width={140} height={140} style={{ objectFit: "cover", borderRadius: 8 }} />
                    )}
                    <div style={{ fontSize: 12, marginTop: 4 }}>{p.name}</div>
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
