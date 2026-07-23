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

export default function BannersManager() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BannerFormState>(EMPTY_FORM);
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
      await uploadFile(`/admin/promo-banners?${params.toString()}`, file);
      setForm(EMPTY_FORM);
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

  async function approve(id: number) {
    await mutateJson(`/admin/promo-banners/${id}/approve`, "POST");
    await load();
  }

  async function reject(id: number) {
    const rejectionNote = window.prompt("Red sebebi (opsiyonel):") ?? undefined;
    await mutateJson(`/admin/promo-banners/${id}/reject`, "POST", { rejectionNote });
    await load();
  }

  async function remove(id: number) {
    if (!confirm("Bu banner silinsin mi?")) return;
    await mutateJson(`/admin/promo-banners/${id}`, "DELETE");
    await load();
  }

  function startEdit(banner: AdminPromoBanner) {
    setEditingId(banner.id);
    setEditForm({
      title: banner.title,
      linkUrl: banner.linkUrl ?? "",
      subtitle: banner.subtitle ?? "",
      buttonText: banner.buttonText ?? "",
      textColor: banner.textColor ?? "#ffffff",
    });
  }

  async function saveEdit(id: number) {
    await mutateJson(`/admin/promo-banners/${id}`, "PATCH", {
      title: editForm.title,
      linkUrl: editForm.linkUrl || undefined,
      subtitle: editForm.subtitle || undefined,
      buttonText: editForm.buttonText || undefined,
      textColor: editForm.textColor || undefined,
    });
    setEditingId(null);
    await load();
  }

  return (
    <div>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Yeni Banner Ekle</h2>
        </div>
        <div className="admin-card-body" style={{ maxWidth: 480 }}>
          <div className="admin-form-group">
            <label>Başlık</label>
            <input className="admin-form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label>Alt Başlık (opsiyonel)</label>
            <input className="admin-form-control" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label>Görsel</label>
            <input className="admin-form-control" ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Buton Metni</label>
              <input
                className="admin-form-control"
                value={form.buttonText}
                onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
              />
            </div>
            <div className="admin-form-group">
              <label>Tıklanınca gidilecek adres</label>
              <input
                className="admin-form-control"
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder="/urunler"
              />
            </div>
          </div>
          <div className="admin-form-group">
            <label>Metin Rengi</label>
            <input className="admin-form-control" type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} />
          </div>
          {error && <p className="error-text" style={{ color: "var(--admin-error)" }}>{error}</p>}
          <button className="admin-btn admin-btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Yükleniyor..." : "Banner Ekle"}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Bannerlar</h2>
        </div>
        {banners === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : banners.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-bullhorn" />
            <h3>Henüz banner yok</h3>
          </div>
        ) : (
          <div className="admin-card-body" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {banners.map((b) => (
              <div key={b.id} style={{ width: 260 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" width={260} height={130} style={{ objectFit: "cover", borderRadius: 6, opacity: b.isActive ? 1 : 0.4 }} />
                <div style={{ fontSize: "0.85rem", marginTop: "0.3rem", fontWeight: 600 }}>{b.title}</div>
                {b.vendorId && (
                  <div style={{ marginTop: "0.2rem" }}>
                    <span className={`admin-badge admin-badge-${b.status === "approved" ? "active" : b.status === "rejected" ? "inactive" : "pending"}`}>
                      {b.status === "approved" ? "Onaylandı" : b.status === "rejected" ? "Reddedildi" : "Onay Bekliyor"}
                    </span>
                    {b.status === "rejected" && b.rejectionNote && (
                      <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: "0.2rem" }}>{b.rejectionNote}</div>
                    )}
                  </div>
                )}

                {editingId === b.id ? (
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <input
                      className="admin-form-control"
                      placeholder="Başlık"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <input
                      className="admin-form-control"
                      placeholder="Alt başlık"
                      value={editForm.subtitle}
                      onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })}
                    />
                    <input
                      className="admin-form-control"
                      placeholder="Buton metni"
                      value={editForm.buttonText}
                      onChange={(e) => setEditForm({ ...editForm, buttonText: e.target.value })}
                    />
                    <input
                      className="admin-form-control"
                      placeholder="/urunler"
                      value={editForm.linkUrl}
                      onChange={(e) => setEditForm({ ...editForm, linkUrl: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }} onClick={() => saveEdit(b.id)}>
                        Kaydet
                      </button>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setEditingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {b.vendorId && b.status === "pending" && (
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.3rem" }}>
                        <button className="admin-btn admin-btn-success admin-btn-sm" style={{ flex: 1 }} onClick={() => approve(b.id)}>
                          Onayla
                        </button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ flex: 1 }} onClick={() => reject(b.id)}>
                          Reddet
                        </button>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", gap: "0.4rem" }}>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" style={{ flex: 1 }} onClick={() => startEdit(b)}>
                        Düzenle
                      </button>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => toggleActive(b)}>
                        {b.isActive ? "Pasife Al" : "Aktif Et"}
                      </button>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => remove(b.id)}>
                        Sil
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
