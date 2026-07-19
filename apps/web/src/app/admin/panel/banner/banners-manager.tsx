"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminPromoBanner } from "@/lib/types";

export default function BannersManager() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setBanners(await fetchJson<AdminPromoBanner[]>("/admin/promo-banners"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Lütfen bir görsel seçin");
      return;
    }
    if (!title.trim()) {
      setError("Başlık gerekli");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ title });
      if (linkUrl) params.set("linkUrl", linkUrl);
      await uploadFile(`/admin/promo-banners?${params.toString()}`, file);
      setTitle("");
      setLinkUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Yükleme başarısız oldu");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(banner: AdminPromoBanner) {
    await mutateJson(`/admin/promo-banners/${banner.id}`, "PATCH", { isActive: !banner.isActive });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Bu banner silinsin mi?")) return;
    await mutateJson(`/admin/promo-banners/${id}`, "DELETE");
    await load();
  }

  if (banners === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <div className="form" style={{ marginTop: "1.5rem", maxWidth: 480 }}>
        <label>
          Başlık
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Görsel
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        </label>
        <label>
          Tıklanınca gidilecek adres (opsiyonel)
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/urunler" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" onClick={handleUpload} disabled={uploading}>
          {uploading ? "Yükleniyor..." : "Banner Ekle"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "2rem" }}>
        {banners.length === 0 ? (
          <p className="empty-state">Henüz banner yok.</p>
        ) : (
          banners.map((b) => (
            <div key={b.id} style={{ width: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt="" width={220} height={110} style={{ objectFit: "cover", borderRadius: 6, opacity: b.isActive ? 1 : 0.4 }} />
              <div style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>{b.title}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", gap: "0.4rem" }}>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem", flex: 1 }} onClick={() => toggleActive(b)}>
                  {b.isActive ? "Pasife Al" : "Aktif Et"}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => remove(b.id)}>
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
