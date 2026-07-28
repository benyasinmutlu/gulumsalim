"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminSlider } from "@/lib/types";
import ImageDropPreview from "@/components/image-drop-preview";

interface SliderFormState {
  linkUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  textColor: string;
  textPosition: string;
  sortOrder: string;
}

const EMPTY_FORM: SliderFormState = { linkUrl: "", title: "", subtitle: "", buttonText: "", textColor: "#ffffff", textPosition: "center", sortOrder: "0" };

export default function SlidersManager() {
  const [sliders, setSliders] = useState<AdminSlider[] | null>(null);
  const [form, setForm] = useState<SliderFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SliderFormState>(EMPTY_FORM);
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
      const params = new URLSearchParams();
      if (form.linkUrl) params.set("linkUrl", form.linkUrl);
      if (form.title) params.set("title", form.title);
      if (form.subtitle) params.set("subtitle", form.subtitle);
      if (form.buttonText) params.set("buttonText", form.buttonText);
      if (form.textColor) params.set("textColor", form.textColor);
      if (form.textPosition) params.set("textPosition", form.textPosition);
      const qs = params.toString() ? `?${params.toString()}` : "";
      await uploadFile(`/admin/sliders${qs}`, file);
      setForm(EMPTY_FORM);
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

  function startEdit(slider: AdminSlider) {
    setEditingId(slider.id);
    setEditForm({
      linkUrl: slider.linkUrl ?? "",
      title: slider.title ?? "",
      subtitle: slider.subtitle ?? "",
      buttonText: slider.buttonText ?? "",
      textColor: slider.textColor ?? "#ffffff",
      textPosition: slider.textPosition ?? "center",
      sortOrder: String(slider.sortOrder ?? 0),
    });
  }

  async function saveEdit(id: number) {
    await mutateJson(`/admin/sliders/${id}`, "PATCH", {
      linkUrl: editForm.linkUrl || undefined,
      title: editForm.title || undefined,
      subtitle: editForm.subtitle || undefined,
      buttonText: editForm.buttonText || undefined,
      textColor: editForm.textColor || undefined,
      textPosition: editForm.textPosition || undefined,
      sortOrder: editForm.sortOrder !== "" ? Number(editForm.sortOrder) : undefined,
    });
    setEditingId(null);
    await load();
  }

  return (
    <div>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Yeni Slider Ekle</h2>
        </div>
        <div className="admin-card-body" style={{ maxWidth: 480 }}>
          <div className="admin-form-group">
            <label>Görsel</label>
            <ImageDropPreview
              inputRef={fileInputRef}
              className="admin-file-drop"
              label="Slayt görseli"
              hint="JPG, PNG, WEBP, GIF"
              accept="image/jpeg,image/png,image/webp,image/gif"
            />
          </div>
          <div className="admin-form-group">
            <label>Başlık (opsiyonel)</label>
            <input className="admin-form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label>Alt Başlık (opsiyonel)</label>
            <input className="admin-form-control" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Buton Metni</label>
              <input
                className="admin-form-control"
                value={form.buttonText}
                onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                placeholder="İncele"
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
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Metin Rengi</label>
              <input className="admin-form-control" type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label>Metin Konumu</label>
              <select className="admin-form-control" value={form.textPosition} onChange={(e) => setForm({ ...form, textPosition: e.target.value })}>
                <option value="left">Sol</option>
                <option value="center">Orta</option>
                <option value="right">Sağ</option>
              </select>
            </div>
          </div>
          {error && <p className="error-text" style={{ color: "var(--admin-error)" }}>{error}</p>}
          <button className="admin-btn admin-btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? "Yükleniyor..." : "Slider Ekle"}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Sliderlar</h2>
        </div>
        {sliders === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : sliders.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-images" />
            <h3>Henüz slider yok</h3>
          </div>
        ) : (
          <div className="admin-card-body" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {sliders.map((s) => (
              <div key={s.id} style={{ width: 260 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" width={260} height={130} style={{ objectFit: "cover", borderRadius: 6, opacity: s.isActive ? 1 : 0.4 }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem" }}>
                  {s.title && <div style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</div>}
                  <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>#{s.sortOrder}</span>
                </div>

                {editingId === s.id ? (
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
                    <input
                      className="admin-form-control"
                      type="number"
                      placeholder="Sıra"
                      value={editForm.sortOrder}
                      onChange={(e) => setEditForm({ ...editForm, sortOrder: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }} onClick={() => saveEdit(s.id)}>
                        Kaydet
                      </button>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setEditingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.4rem", gap: "0.4rem" }}>
                    <button className="admin-btn admin-btn-secondary admin-btn-sm" style={{ flex: 1 }} onClick={() => startEdit(s)}>
                      Düzenle
                    </button>
                    <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => toggleActive(s)}>
                      {s.isActive ? "Pasife Al" : "Aktif Et"}
                    </button>
                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => remove(s.id)}>
                      Sil
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
