"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

interface FormState {
  storeName: string;
  fullName: string;
  phone: string;
  about: string;
  city: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  tiktok: string;
  website: string;
  seoTitle: string;
  seoDescription: string;
}

function toFormState(v: VendorProfile): FormState {
  return {
    storeName: v.storeName,
    fullName: v.fullName,
    phone: v.phone ?? "",
    about: v.about ?? "",
    city: v.city ?? "",
    whatsapp: v.whatsapp ?? "",
    instagram: v.instagram ?? "",
    facebook: v.facebook ?? "",
    twitter: v.twitter ?? "",
    youtube: v.youtube ?? "",
    tiktok: v.tiktok ?? "",
    website: v.website ?? "",
    seoTitle: v.seoTitle ?? "",
    seoDescription: v.seoDescription ?? "",
  };
}

export default function StoreProfileForm() {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetchJson<VendorProfile>("/vendor/auth/me").then((v) => {
      setVendor(v);
      setForm(toFormState(v));
    });
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await mutateJson<VendorProfile>("/vendor/auth/me", "PATCH", form);
      setVendor(updated);
      setMessage({ type: "ok", text: "Mağaza profili güncellendi" });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(field: "logo" | "coverImage", file: File) {
    const setUploading = field === "logo" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    setMessage(null);
    try {
      const updated = await uploadFile<VendorProfile>(field === "logo" ? "/vendor/profile/logo" : "/vendor/profile/cover", file);
      setVendor(updated);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Görsel yüklenemedi" });
    } finally {
      setUploading(false);
    }
  }

  if (!vendor || !form) {
    return <div className="card"><div className="card-body">Yükleniyor...</div></div>;
  }

  return (
    <div className="fc" style={{ gap: 20 }}>
      <div className="card">
        <div className="ch" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Mağaza Profili</h3>
          <a href={`/${vendor.storeSlug}`} target="_blank" rel="noreferrer" className="btn">
            Sitede Görüntüle
          </a>
        </div>
        <div className="card-body">
          <div className="row2" style={{ marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>Logo</label>
              {vendor.logo && <img src={vendor.logo} alt="Logo" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, marginBottom: 8 }} />}
              <input type="file" accept="image/*" disabled={uploadingLogo} onChange={(e) => e.target.files?.[0] && handleImageUpload("logo", e.target.files[0])} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>Kapak Görseli</label>
              {vendor.coverImage && <img src={vendor.coverImage} alt="Kapak" style={{ width: "100%", maxWidth: 220, height: 80, objectFit: "cover", borderRadius: 12, marginBottom: 8 }} />}
              <input type="file" accept="image/*" disabled={uploadingCover} onChange={(e) => e.target.files?.[0] && handleImageUpload("coverImage", e.target.files[0])} />
            </div>
          </div>

          <form className="fc" onSubmit={handleSubmit}>
            <div className="fg">
              <label>Mağaza Adı</label>
              <input className="fi" value={form.storeName} onChange={(e) => set("storeName", e.target.value)} required />
            </div>
            <div className="fg">
              <label>Yetkili Adı Soyadı</label>
              <input className="fi" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
            </div>
            <div className="fg">
              <label>Hakkımızda</label>
              <textarea className="fi" rows={4} value={form.about} onChange={(e) => set("about", e.target.value)} placeholder="Mağazanızı müşterilerinize tanıtın..." />
            </div>
            <div className="row2">
              <div className="fg">
                <label>Telefon</label>
                <input className="fi" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="fg">
                <label>Şehir</label>
                <input className="fi" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
            </div>

            <h4 style={{ margin: "12px 0 0" }}>Sosyal Medya</h4>
            <div className="row2">
              <div className="fg">
                <label>WhatsApp</label>
                <input className="fi" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="905xxxxxxxxx" />
              </div>
              <div className="fg">
                <label>Instagram</label>
                <input className="fi" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div className="fg">
                <label>Facebook</label>
                <input className="fi" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} />
              </div>
              <div className="fg">
                <label>Twitter / X</label>
                <input className="fi" value={form.twitter} onChange={(e) => set("twitter", e.target.value)} />
              </div>
              <div className="fg">
                <label>YouTube</label>
                <input className="fi" value={form.youtube} onChange={(e) => set("youtube", e.target.value)} />
              </div>
              <div className="fg">
                <label>TikTok</label>
                <input className="fi" value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} />
              </div>
              <div className="fg">
                <label>Web Sitesi</label>
                <input className="fi" value={form.website} onChange={(e) => set("website", e.target.value)} />
              </div>
            </div>

            <h4 style={{ margin: "12px 0 0" }}>SEO</h4>
            <div className="fg">
              <label>SEO Başlığı</label>
              <input className="fi" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            </div>
            <div className="fg">
              <label>SEO Açıklaması</label>
              <textarea className="fi" rows={2} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
            </div>

            {message && <p style={{ color: message.type === "ok" ? "var(--su, green)" : "var(--er)", fontSize: "0.85rem" }}>{message.text}</p>}
            <button className="btn btn-pr" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
