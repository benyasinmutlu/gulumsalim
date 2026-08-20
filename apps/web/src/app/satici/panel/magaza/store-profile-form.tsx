"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorDashboardData, VendorProfile } from "@/lib/types";

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

const SOCIAL_FIELDS: { key: keyof FormState; label: string; icon: string; placeholder: string }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: "fa-whatsapp", placeholder: "905xxxxxxxxx" },
  { key: "instagram", label: "Instagram", icon: "fa-instagram", placeholder: "https://instagram.com/magazam" },
  { key: "facebook", label: "Facebook", icon: "fa-facebook", placeholder: "https://facebook.com/magazam" },
  { key: "twitter", label: "Twitter / X", icon: "fa-twitter", placeholder: "https://x.com/magazam" },
  { key: "youtube", label: "YouTube", icon: "fa-youtube", placeholder: "https://youtube.com/@magazam" },
  { key: "tiktok", label: "TikTok", icon: "fa-tiktok", placeholder: "https://tiktok.com/@magazam" },
];

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
  const [stats, setStats] = useState<{ productCount: number; followerCount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchJson<VendorProfile>("/vendor/auth/me").then((v) => {
      setVendor(v);
      setForm(toFormState(v));
    });
    fetchJson<VendorDashboardData>("/vendor/dashboard").then((d) => {
      setStats({ productCount: d.stats.productCount, followerCount: d.stats.followerCount });
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

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setMessage(null);
    try {
      const updated = await uploadFile<VendorProfile>("/vendor/profile/logo", file);
      setVendor(updated);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Görsel yüklenemedi" });
    } finally {
      setUploadingLogo(false);
    }
  }

  // bkz. kullanıcı isteği: "mağazalarda resim olsun uygun bir şekilde" -
  // kapak fotoğrafı satıcının KENDİ genel sayfasında (vendor-storefront.tsx,
  // sade tasarım) gösterilmiyor, ama /magazalar dizin listesindeki mağaza
  // kartının arka planı olarak KULLANILIYOR (bkz. magazalar/page.tsx
  // .store-cover) - bu yükleme kontrolü daha önce "hiçbir yerde
  // görünmüyor" varsayımıyla kaldırılmıştı, bu yanlıştı.
  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    setMessage(null);
    try {
      const updated = await uploadFile<VendorProfile>("/vendor/profile/cover", file);
      setVendor(updated);
    } catch (err) {
      setMessage({ type: "err", text: err instanceof ClientApiError ? err.message : "Görsel yüklenemedi" });
    } finally {
      setUploadingCover(false);
    }
  }

  if (!vendor || !form) {
    return <div className="card"><div className="card-body">Yükleniyor...</div></div>;
  }

  return (
    <div className="fc" style={{ gap: 20 }}>
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Mağazanın herkese açık sayfasındaki görünümün canlı önizlemesi -
            aynı .vendor-header/.vendor-avatar-flat sınıflarını kullanır
            (bkz. kullanıcı isteği: "mağaza sayfasını mockup'taki gibi sade
            yap" - kendi genel sayfasında kapak fotoğrafı yok, bu yüzden
            burada gösterilmiyor; kapak yükleme kontrolü aşağıda ayrı bir
            bölümde, /magazalar dizin kartı için). */}
        <div className="vendor-header" style={{ padding: 20 }}>
          <div className="vendor-header-row">
            <div style={{ position: "relative" }}>
              <div className="vendor-avatar-flat">
                {vendor.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.logo} alt="" />
                ) : (
                  vendor.storeName.charAt(0)
                )}
              </div>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                title="Logoyu Değiştir"
                style={{
                  position: "absolute", bottom: -4, right: -4,
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--pr)", color: "#fff", border: "3px solid #fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 11,
                }}
              >
                <i className="fas fa-camera" />
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
            </div>
            <div className="vendor-header-info">
              <div className="vendor-header-name-row">
                <h1>{form.storeName || vendor.storeName}</h1>
              </div>
              <div className="vendor-header-stats">
                <span>{stats?.productCount ?? "…"} Ürün</span>
                <span>{stats?.followerCount ?? "…"} Takipçi</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "10px 20px", fontSize: 12, color: "var(--tx3)", borderBottom: "1px solid var(--br)" }}>
          <i className="fas fa-eye" /> Bu, mağazanızın <a href={`/${vendor.storeSlug}`} target="_blank" rel="noreferrer" style={{ color: "var(--pr)", fontWeight: 600 }}>herkese açık sayfasında</a> nasıl görüneceğinin önizlemesidir.
        </div>

        <div className="card-body">
          <form className="fc" onSubmit={handleSubmit}>
            <div className="row2">
              <div className="fg">
                <label>Mağaza Adı</label>
                <input className="fi" value={form.storeName} onChange={(e) => set("storeName", e.target.value)} required />
              </div>
              <div className="fg">
                <label>Yetkili Adı Soyadı</label>
                <input className="fi" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
              </div>
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

            <div style={{ borderTop: "1px solid var(--br)", paddingTop: 16, marginTop: 4 }}>
              <h4 style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-image" style={{ color: "var(--pr)" }} /> Kapak Fotoğrafı
              </h4>
              <p style={{ fontSize: 12, color: "var(--tx3)", margin: "0 0 12px" }}>
                <i className="fas fa-eye" /> Mağazalar dizinindeki (
                <a href="/magazalar" target="_blank" rel="noreferrer" style={{ color: "var(--pr)", fontWeight: 600 }}>
                  /magazalar
                </a>
                ) kartınızın arka planında görünür.
              </p>
              <div
                style={{
                  position: "relative",
                  height: 120,
                  borderRadius: 12,
                  overflow: "hidden",
                  background: vendor.coverImage ? undefined : "var(--s2)",
                  border: "1px solid var(--br)",
                }}
              >
                {vendor.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="btn btn-sec btn-sm"
                  style={{ position: "absolute", bottom: 10, right: 10 }}
                >
                  <i className="fas fa-camera" /> {uploadingCover ? "Yükleniyor..." : "Kapağı Değiştir"}
                </button>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
              />
            </div>

            <div style={{ borderTop: "1px solid var(--br)", paddingTop: 16, marginTop: 4 }}>
              <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-share-nodes" style={{ color: "var(--pr)" }} /> Sosyal Medya &amp; İletişim
              </h4>
              <div className="row2">
                {SOCIAL_FIELDS.map((f) => (
                  <div className="fg" key={f.key}>
                    <label>{f.label}</label>
                    <div style={{ position: "relative" }}>
                      <i className={`fab ${f.icon}`} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--tx3)", fontSize: 14 }} />
                      <input className="fi" style={{ paddingLeft: 34 }} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
                    </div>
                  </div>
                ))}
                <div className="fg">
                  <label>Web Sitesi</label>
                  <div style={{ position: "relative" }}>
                    <i className="fas fa-globe" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--tx3)", fontSize: 14 }} />
                    <input className="fi" style={{ paddingLeft: 34 }} value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://magazam.com" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--br)", paddingTop: 16, marginTop: 4 }}>
              <h4 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <i className="fas fa-search" style={{ color: "var(--pr)" }} /> SEO
              </h4>
              <div className="fg">
                <label>SEO Başlığı</label>
                <input className="fi" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder={`${form.storeName} | Gülüm Şalım`} />
              </div>
              <div className="fg">
                <label>SEO Açıklaması</label>
                <textarea className="fi" rows={2} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
              </div>
            </div>

            {message && <p style={{ color: message.type === "ok" ? "var(--ok)" : "var(--er)", fontSize: "0.85rem" }}>{message.text}</p>}
            <button className="btn btn-pr" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
