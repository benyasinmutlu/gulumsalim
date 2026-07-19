"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminSlider } from "@/lib/types";

export default function SlidersManager() {
  const [sliders, setSliders] = useState<AdminSlider[] | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setSliders(await fetchJson<AdminSlider[]>("/admin/sliders"));
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
    setUploading(true);
    setError(null);
    try {
      const qs = linkUrl ? `?linkUrl=${encodeURIComponent(linkUrl)}` : "";
      await uploadFile(`/admin/sliders${qs}`, file);
      setLinkUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Yükleme başarısız oldu");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(slider: AdminSlider) {
    await mutateJson(`/admin/sliders/${slider.id}`, "PATCH", { isActive: !slider.isActive });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Bu slider silinsin mi?")) return;
    await mutateJson(`/admin/sliders/${id}`, "DELETE");
    await load();
  }

  if (sliders === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div>
      <div className="form" style={{ marginTop: "1.5rem", maxWidth: 480 }}>
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
          {uploading ? "Yükleniyor..." : "Slider Ekle"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "2rem" }}>
        {sliders.length === 0 ? (
          <p className="empty-state">Henüz slider yok.</p>
        ) : (
          sliders.map((s) => (
            <div key={s.id} style={{ width: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image} alt="" width={220} height={110} style={{ objectFit: "cover", borderRadius: 6, opacity: s.isActive ? 1 : 0.4 }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem", gap: "0.4rem" }}>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem", flex: 1 }} onClick={() => toggleActive(s)}>
                  {s.isActive ? "Pasife Al" : "Aktif Et"}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => remove(s.id)}>
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
