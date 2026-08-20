"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorStoreSlide } from "@/lib/types";
import ImageDropPreview from "@/components/image-drop-preview";

interface Props {
  onSaved?: () => void;
}

export default function SlidesManager({ onSaved }: Props) {
  const [slides, setSlides] = useState<VendorStoreSlide[] | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setSlides(await fetchJson<VendorStoreSlide[]>("/vendor/store-slides"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Lütfen bir görsel seçin");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (title) params.set("title", title);
      if (subtitle) params.set("subtitle", subtitle);
      if (buttonText) params.set("buttonText", buttonText);
      if (linkUrl) params.set("linkUrl", linkUrl);
      await uploadFile(`/vendor/store-slides?${params.toString()}`, file);
      setTitle("");
      setSubtitle("");
      setButtonText("");
      setLinkUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Slayt eklenemedi");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    await mutateJson(`/vendor/store-slides/${id}`, "DELETE");
    await load();
    onSaved?.();
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Mağaza Slider&apos;ı</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: "0.85rem", color: "var(--tx3)", marginBottom: 16 }}>
          Mağaza sayfanızın &quot;Slider&quot; bölümü görünür olduğunda üstte gösterilecek slaytlar.
        </p>

        {slides === null ? (
          <p>Yükleniyor...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {slides.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--s2)", borderRadius: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" style={{ width: 80, height: 40, objectFit: "cover", borderRadius: 6 }} />
                <span style={{ flex: 1, fontSize: "0.85rem" }}>{s.title || "(başlıksız)"}</span>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                  Sil
                </button>
              </div>
            ))}
            {slides.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Henüz slayt eklenmedi.</p>}
          </div>
        )}

        <div className="fc" style={{ gap: 10 }}>
          <div className="fg">
            <label>Görsel</label>
            <ImageDropPreview
              inputRef={fileInputRef}
              label="Slayt görseli"
              hint="JPG, PNG, WEBP, GIF"
              accept="image/jpeg,image/png,image/webp,image/gif"
            />
          </div>
          <div className="fg">
            <label>Başlık</label>
            <input className="fi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <div className="fg">
            <label>Alt Başlık</label>
            <input className="fi" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <div className="fg">
            <label>Buton Metni</label>
            <input className="fi" value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <div className="fg">
            <label>Link</label>
            <input className="fi" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Opsiyonel" />
          </div>
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" onClick={handleAdd} disabled={uploading} style={{ alignSelf: "flex-start" }}>
            {uploading ? "Ekleniyor..." : "Slayt Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
