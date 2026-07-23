"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminPromoBanner } from "@/lib/types";

interface BannerFormState {
  title: string;
  linkUrl: string;
  subtitle: string;
  buttonText: string;
  textColor: string;
}

const EMPTY_FORM: BannerFormState = { title: "", linkUrl: "", subtitle: "", buttonText: "", textColor: "#ffffff" };

const STATUS_LABEL: Record<AdminPromoBanner["status"], string> = {
  pending: "Onay Bekliyor",
  approved: "Onaylandı ve Yayında",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<AdminPromoBanner["status"], string> = {
  pending: "warn",
  approved: "success",
  rejected: "danger",
};

// gulumsalim.com'daki vendor/promo-banners.php'nin karşılığı - satıcı
// kendi kampanya bannerını oluşturur, admin onayından sonra anasayfada
// yayınlanır (bkz. admin/panel/banner/banners-manager.tsx'teki onay/red).
export default function BannersManager() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setBanners(await fetchJson<AdminPromoBanner[]>("/vendor/promo-banners"));
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
    if (!form.title.trim()) {
      setError("Başlık gerekli");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ title: form.title });
      if (form.linkUrl) params.set("linkUrl", form.linkUrl);
      if (form.subtitle) params.set("subtitle", form.subtitle);
      if (form.buttonText) params.set("buttonText", form.buttonText);
      if (form.textColor) params.set("textColor", form.textColor);
      await uploadFile(`/vendor/promo-banners?${params.toString()}`, file);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Yükleme başarısız oldu");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Bu banner silinsin mi?")) return;
    await mutateJson(`/vendor/promo-banners/${id}`, "DELETE");
    await load();
  }

  return (
    <div>
      <div className="card">
        <div className="ch">
          <h3>Yeni Kampanya Bannerı</h3>
        </div>
        <div className="card-body" style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div className="fg">
            <label>Başlık</label>
            <input className="fi" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="fg">
            <label>Alt Başlık (opsiyonel)</label>
            <input className="fi" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          </div>
          <div className="fg">
            <label>Görsel</label>
            <input className="fi" ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <div className="fg">
            <label>Buton Metni</label>
            <input className="fi" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
          </div>
          <div className="fg">
            <label>Tıklanınca gidilecek adres</label>
            <input className="fi" value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="/urunler" />
          </div>
          <div className="fg">
            <label>Metin Rengi</label>
            <input type="color" className="fi" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} />
          </div>
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Gönderiliyor..." : "Onaya Gönder"}
          </button>
          <p style={{ fontSize: "0.8rem", color: "var(--tx3)" }}>
            Gönderdiğiniz banner admin onayından geçtikten sonra anasayfada yayınlanır.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Bannerlarım</h3>
        </div>
        {banners === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : banners.length === 0 ? (
          <div className="empty">
            <i className="fas fa-bullhorn" />
            <p>Henüz kampanya bannerı göndermediniz.</p>
          </div>
        ) : (
          <div className="card-body" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {banners.map((b) => (
              <div key={b.id} style={{ width: 240 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" width={240} height={120} style={{ objectFit: "cover", borderRadius: 6 }} />
                <div style={{ fontSize: "0.85rem", marginTop: "0.3rem", fontWeight: 600 }}>{b.title}</div>
                <span className={`st st-${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                {b.status === "rejected" && b.rejectionNote && (
                  <div style={{ fontSize: "0.75rem", color: "var(--tx3)", marginTop: "0.2rem" }}>{b.rejectionNote}</div>
                )}
                <div style={{ marginTop: "0.4rem" }}>
                  <button className="btn btn-sec btn-sm" onClick={() => remove(b.id)}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
