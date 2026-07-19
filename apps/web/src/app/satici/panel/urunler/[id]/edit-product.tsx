"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorProduct, VendorProductImage } from "@/lib/types";

export default function EditProduct({ productId }: { productId: number }) {
  const [product, setProduct] = useState<VendorProduct | null>(null);
  const [images, setImages] = useState<VendorProductImage[]>([]);
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [productList, imageList] = await Promise.all([
      fetchJson<VendorProduct[]>("/vendor/products"),
      fetchJson<VendorProductImage[]>(`/vendor/products/${productId}/images`),
    ]);
    const found = productList.find((p) => p.id === productId) ?? null;
    setProduct(found);
    if (found) {
      setName(found.name);
      setBasePrice(found.basePrice);
      setDescription(found.description ?? "");
    }
    setImages(imageList);
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
        basePrice: Number(basePrice),
        description: description || undefined,
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

  if (product === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <div className="form" style={{ marginTop: "1rem" }}>
        <label>
          Ürün Adı
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Fiyat (₺)
          <input type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
        </label>
        <label>
          Açıklama
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {message && <p style={{ fontSize: "0.85rem" }}>{message}</p>}
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      <h3 style={{ fontSize: "0.95rem", marginTop: "2rem", marginBottom: "0.75rem" }}>Görseller</h3>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {images.map((img) => (
          <div key={img.id} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" width={110} height={110} style={{ objectFit: "cover", borderRadius: 6 }} />
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", marginTop: "0.3rem", width: "100%" }}
              onClick={() => handleDeleteImage(img.id)}
            >
              Sil
            </button>
          </div>
        ))}
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelected} disabled={uploading} />
      {uploading && <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>Yükleniyor...</p>}
    </div>
  );
}
