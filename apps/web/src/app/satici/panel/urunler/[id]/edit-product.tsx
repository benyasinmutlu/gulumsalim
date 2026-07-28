"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { Category, VendorProduct, VendorProductImage, VendorProductVariant } from "@/lib/types";

export default function EditProduct({ productId }: { productId: number }) {
  const [product, setProduct] = useState<VendorProduct | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<VendorProductImage[]>([]);
  const [variants, setVariants] = useState<VendorProductVariant[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [freeShipping, setFreeShipping] = useState(false);
  const [isSecondHand, setIsSecondHand] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [variantSize, setVariantSize] = useState("");
  const [variantColor, setVariantColor] = useState("");
  const [variantStock, setVariantStock] = useState("0");
  const [variantPriceOverride, setVariantPriceOverride] = useState("");
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  async function load() {
    const [productList, imageList, variantList, categoryList] = await Promise.all([
      fetchJson<VendorProduct[]>("/vendor/products"),
      fetchJson<VendorProductImage[]>(`/vendor/products/${productId}/images`),
      fetchJson<VendorProductVariant[]>(`/vendor/products/${productId}/variants`),
      fetchJson<Category[]>("/categories"),
    ]);
    const found = productList.find((p) => p.id === productId) ?? null;
    setProduct(found);
    if (found) {
      setName(found.name);
      setCategoryId(found.categoryId);
      setBasePrice(found.basePrice);
      setCompareAtPrice(found.compareAtPrice ?? "");
      setBrand(found.brand ?? "");
      setDescription(found.description ?? "");
      setStatus(found.status);
      setFreeShipping(found.freeShipping);
      setIsSecondHand(found.isSecondHand ?? false);
    }
    setImages(imageList);
    setVariants(variantList);
    setCategories(categoryList);
  }

  useEffect(() => {
    load();
  }, [productId]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await mutateJson(`/vendor/products/${productId}`, "PATCH", {
        name,
        categoryId: categoryId || undefined,
        basePrice: Number(basePrice),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
        brand: brand || undefined,
        description: description || undefined,
        status,
        freeShipping,
        isSecondHand,
      });
      setMessage("Kaydedildi.");
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelected() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadFile(`/vendor/products/${productId}/images`, file);
      await load();
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteImage(imageId: number) {
    await mutateJson(`/vendor/products/${productId}/images/${imageId}`, "DELETE");
    await load();
  }

  async function handleSetPrimaryImage(imageId: number) {
    await mutateJson(`/vendor/products/${productId}/images/${imageId}/primary`, "POST");
    await load();
  }

  async function handleAddVariant(e: FormEvent) {
    e.preventDefault();
    setVariantSaving(true);
    setVariantError(null);
    try {
      await mutateJson(`/vendor/products/${productId}/variants`, "POST", {
        size: variantSize || undefined,
        color: variantColor || undefined,
        stock: Number(variantStock),
        priceOverride: variantPriceOverride ? Number(variantPriceOverride) : undefined,
      });
      setVariantSize("");
      setVariantColor("");
      setVariantStock("0");
      setVariantPriceOverride("");
      await load();
    } catch (err) {
      setVariantError(err instanceof ClientApiError ? err.message : "Varyant eklenemedi");
    } finally {
      setVariantSaving(false);
    }
  }

  async function handleDeleteVariant(variantId: number) {
    await mutateJson(`/vendor/products/${productId}/variants/${variantId}`, "DELETE");
    await load();
  }

  async function handleVariantStockChange(variantId: number, stock: number) {
    await mutateJson(`/vendor/products/${productId}/variants/${variantId}`, "PATCH", { stock });
    await load();
  }

  if (product === null) return <div className="card"><div className="card-body">Yükleniyor...</div></div>;

  return (
    <div>
      <div className="card">
        <div className="ch">
          <h3>Ürün Bilgileri</h3>
        </div>
        <div className="fc" style={{ padding: "20px" }}>
          <div className="fg">
            <label>Ürün Adı</label>
            <input className="fi" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fg">
            <label>Kategori</label>
            <select className="fi" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Marka</label>
            <input className="fi" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <div className="row2">
            <div className="fg">
              <label>Fiyat (₺)</label>
              <input className="fi" type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div className="fg">
              <label>İndirimli Fiyat (₺)</label>
              <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
            </div>
          </div>
          <div className="fg">
            <label>Durum</label>
            <select className="fi" value={status} onChange={(e) => setStatus(e.target.value)} disabled={status === "rejected"}>
              {status === "rejected" && <option value="rejected">Reddedildi (admin tarafından)</option>}
              <option value="draft">Taslak</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
          <div className="fg">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} />
              Bu ürün için kargo her zaman ücretsiz
            </label>
          </div>
          <div className="fg">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={isSecondHand} onChange={(e) => setIsSecondHand(e.target.checked)} />
              Bu ürün 2. el
            </label>
          </div>
          <div className="fg">
            <label>Açıklama</label>
            <textarea className="fi" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ürününüzü müşterilere anlatın: kumaş, kalıp, bakım önerileri..." />
          </div>
          {message && <p style={{ fontSize: "0.85rem" }}>{message}</p>}
          <button className="btn btn-pr" onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Görseller</h3>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            {images.map((img) => (
              <div key={img.id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  width={110}
                  height={110}
                  className="img-preview"
                  style={{ width: 110, height: 110, outline: img.isPrimary ? "3px solid var(--pr)" : "none", outlineOffset: 2 }}
                />
                {img.isPrimary ? (
                  <span style={{ display: "block", textAlign: "center", fontSize: "0.7rem", color: "var(--pr)", fontWeight: 700, marginTop: "0.3rem" }}>
                    <i className="fas fa-star" /> Vitrin Görseli
                  </span>
                ) : (
                  <button
                    className="btn btn-sec btn-sm"
                    style={{ marginTop: "0.3rem", width: "100%" }}
                    onClick={() => handleSetPrimaryImage(img.id)}
                  >
                    Vitrin Görseli Yap
                  </button>
                )}
                <button className="btn btn-danger btn-sm" style={{ marginTop: "0.3rem", width: "100%" }} onClick={() => handleDeleteImage(img.id)}>
                  Sil
                </button>
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelected} disabled={uploading} />
          {uploading && <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>Yükleniyor...</p>}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Beden / Renk Varyantları</h3>
        </div>
        {variants.length === 0 ? (
          <div className="empty">
            <i className="fas fa-ruler" />
            <p>Henüz varyant eklenmedi. Varyant eklenmezse müşteri ürünü tek bir seçenek olarak satın alır.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Beden</th>
                  <th>Renk</th>
                  <th>Fiyat Farkı (₺)</th>
                  <th>Stok</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.sku}</td>
                    <td>{v.size ?? "—"}</td>
                    <td>{v.color ?? "—"}</td>
                    <td>{v.priceOverride ?? "—"}</td>
                    <td>
                      <input
                        className="fi"
                        type="number"
                        min={0}
                        defaultValue={v.stock}
                        style={{ width: "80px" }}
                        onBlur={(e) => handleVariantStockChange(v.id, Number(e.target.value))}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteVariant(v.id)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ padding: "16px 20px 0", fontSize: "0.8rem", color: "var(--tx3)" }}>
          <i className="fas fa-info-circle" /> SKU kodu sistem tarafından otomatik oluşturulur.
        </p>
        <form className="row4" style={{ padding: "16px 20px", alignItems: "flex-end" }} onSubmit={handleAddVariant}>
          <div className="fg">
            <label>Beden</label>
            <input className="fi" value={variantSize} onChange={(e) => setVariantSize(e.target.value)} placeholder="S, M, L..." />
          </div>
          <div className="fg">
            <label>Renk</label>
            <input className="fi" value={variantColor} onChange={(e) => setVariantColor(e.target.value)} />
          </div>
          <div className="fg">
            <label>Stok</label>
            <input className="fi" type="number" min={0} value={variantStock} onChange={(e) => setVariantStock(e.target.value)} />
          </div>
          <div className="fg">
            <label>Fiyat Farkı (₺)</label>
            <input className="fi" type="number" step="0.01" value={variantPriceOverride} onChange={(e) => setVariantPriceOverride(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <button className="btn btn-pr" type="submit" disabled={variantSaving}>
            {variantSaving ? "Ekleniyor..." : "Varyant Ekle"}
          </button>
        </form>
        {variantError && <p style={{ color: "var(--er)", fontSize: "0.85rem", padding: "0 20px 16px" }}>{variantError}</p>}
      </div>
    </div>
  );
}
