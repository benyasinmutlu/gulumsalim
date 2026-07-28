"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminProfile } from "@/lib/types";

type SettingsMap = Record<string, string>;

const TABS = [
  { key: "store", label: "Mağaza", icon: "fa-store" },
  { key: "appearance", label: "Görünüm", icon: "fa-palette" },
  { key: "contact", label: "İletişim Sayfası", icon: "fa-address-card" },
  { key: "shipping", label: "Kargo", icon: "fa-truck" },
  { key: "seo", label: "SEO", icon: "fa-search" },
  { key: "social", label: "Sosyal Medya", icon: "fa-share-alt" },
  { key: "analytics", label: "Analitik", icon: "fa-chart-line" },
  { key: "profile", label: "Profil", icon: "fa-user" },
  { key: "security", label: "Güvenlik", icon: "fa-lock" },
] as const;

const DEFAULT_COLORS = {
  color_primary: "#C06C84",
  color_primary_dark: "#8B3A62",
  color_secondary: "#6C5B7B",
  color_accent: "#F67280",
};

type TabKey = (typeof TABS)[number]["key"];

// gulumsalim.com'daki admin/settings.php'nin karşılığı - iyzico API
// anahtarları kasıtlı olarak burada YOK: .env'de tutulmaları admin
// arayüzünden düzenlenebilir olmalarından daha güvenli (sızıntı riskini
// azaltır), bu bilinçli bir sapma.
export default function SettingsManager() {
  const [tab, setTab] = useState<TabKey>("store");
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [form, setForm] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [s, a] = await Promise.all([
      fetchJson<SettingsMap>("/admin/settings"),
      fetchJson<AdminProfile>("/admin/profile"),
    ]);
    setSettings(s);
    setForm(s);
    setAdmin(a);
  }

  useEffect(() => {
    load();
  }, []);

  function field(key: string) {
    return form[key] ?? "";
  }

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveFields(keys: string[]) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = Object.fromEntries(keys.map((k) => [k, form[k] ?? ""]));
      const updated = await mutateJson<SettingsMap>("/admin/settings", "PATCH", payload);
      setSettings(updated);
      setMessage("Kaydedildi.");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload() {
    const file = logoInputRef.current?.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const result = await uploadFile<{ site_logo: string }>("/admin/settings/logo", file);
      setSettings((s) => ({ ...(s ?? {}), site_logo: result.site_logo }));
      setForm((f) => ({ ...f, site_logo: result.site_logo }));
      setMessage("Logo güncellendi.");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Logo yüklenemedi");
    } finally {
      setSaving(false);
    }
  }

  const [profileFullName, setProfileFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (admin) setProfileFullName(admin.fullName);
  }, [admin]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await mutateJson<AdminProfile>("/admin/profile", "PATCH", { fullName: profileFullName });
      setAdmin(updated);
      setMessage("Profil güncellendi.");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await mutateJson("/admin/profile", "PATCH", { currentPassword, newPassword });
      setMessage("Şifreniz güncellendi.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Şifre güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  if (settings === null || admin === null) {
    return <div className="admin-content">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="tab-nav">
        {TABS.map((t) => (
          <button key={t.key} className={`tab-btn${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            <i className={`fas ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      {message && <div className="alert" style={{ marginBottom: 16, color: "var(--admin-success)" }}>{message}</div>}
      {error && <div className="alert" style={{ marginBottom: 16, color: "var(--admin-error)" }}>{error}</div>}

      {tab === "store" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Mağaza Bilgileri</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Mağaza Adı</label>
                <input className="admin-form-control" value={field("site_name")} onChange={(e) => setField("site_name", e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>E-posta</label>
                <input className="admin-form-control" value={field("site_email")} onChange={(e) => setField("site_email", e.target.value)} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Telefon</label>
                <input className="admin-form-control" value={field("site_phone")} onChange={(e) => setField("site_phone", e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>WhatsApp</label>
                <input className="admin-form-control" value={field("site_whatsapp")} onChange={(e) => setField("site_whatsapp", e.target.value)} />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Adres</label>
              <textarea className="admin-form-control" value={field("site_address")} onChange={(e) => setField("site_address", e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label>Footer Açıklaması</label>
              <textarea className="admin-form-control" value={field("footer_about")} onChange={(e) => setField("footer_about", e.target.value)} />
            </div>
            <button
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => saveFields(["site_name", "site_email", "site_phone", "site_whatsapp", "site_address", "footer_about"])}
            >
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "appearance" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Site Logosu</h2>
          </div>
          <div className="admin-card-body">
            {settings.site_logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.site_logo} alt="Logo" style={{ height: 56, marginBottom: 10, objectFit: "contain" }} />
            )}
            <div className="admin-form-group">
              <div className="admin-file-drop">
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
                <i className="fas fa-image" />
                <p>Logo yükle</p>
                <small>JPG, PNG, WEBP, GIF</small>
              </div>
            </div>
            <button className="admin-btn admin-btn-secondary" disabled={saving} onClick={handleLogoUpload}>
              <i className="fas fa-upload" /> Logoyu Yükle
            </button>
          </div>
        </div>
      )}

      {tab === "appearance" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Renk Paleti</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Ana Renk</label>
                <input type="color" className="admin-form-control" value={field("color_primary") || "#C06C84"} onChange={(e) => setField("color_primary", e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>Ana Renk (Koyu)</label>
                <input type="color" className="admin-form-control" value={field("color_primary_dark") || "#8B3A62"} onChange={(e) => setField("color_primary_dark", e.target.value)} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>İkincil Renk</label>
                <input type="color" className="admin-form-control" value={field("color_secondary") || "#6C5B7B"} onChange={(e) => setField("color_secondary", e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>Vurgu Rengi</label>
                <input type="color" className="admin-form-control" value={field("color_accent") || "#F67280"} onChange={(e) => setField("color_accent", e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="admin-btn admin-btn-primary"
                disabled={saving}
                onClick={() => saveFields(["color_primary", "color_primary_dark", "color_secondary", "color_accent"])}
              >
                <i className="fas fa-save" /> Görünümü Kaydet
              </button>
              <button
                className="admin-btn admin-btn-secondary"
                disabled={saving}
                onClick={() => {
                  setForm((f) => ({ ...f, ...DEFAULT_COLORS }));
                  saveFields(Object.keys(DEFAULT_COLORS));
                }}
              >
                <i className="fas fa-rotate-left" /> Varsayılana Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "appearance" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Anasayfa Slider Görünümü</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Masaüstü Yükseklik (ör. 520px)</label>
                <input className="admin-form-control" value={field("hero_height_desktop")} onChange={(e) => setField("hero_height_desktop", e.target.value)} placeholder="520px" />
              </div>
              <div className="admin-form-group">
                <label>Mobil Yükseklik (ör. 400px)</label>
                <input className="admin-form-control" value={field("hero_height_mobile")} onChange={(e) => setField("hero_height_mobile", e.target.value)} placeholder="400px" />
              </div>
              <div className="admin-form-group">
                <label>Geçiş Süresi (ms)</label>
                <input type="number" className="admin-form-control" value={field("hero_interval_ms")} onChange={(e) => setField("hero_interval_ms", e.target.value)} placeholder="6000" />
              </div>
            </div>
            <button
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => saveFields(["hero_height_desktop", "hero_height_mobile", "hero_interval_ms"])}
            >
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Analitik Entegrasyonları</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label>Google Analytics (GA4) Ölçüm Kimliği</label>
              <input className="admin-form-control" value={field("ga_measurement_id")} onChange={(e) => setField("ga_measurement_id", e.target.value)} placeholder="G-XXXXXXXXXX" />
            </div>
            <div className="admin-form-group">
              <label>Google Tag Manager Kapsayıcı Kimliği</label>
              <input className="admin-form-control" value={field("gtm_container_id")} onChange={(e) => setField("gtm_container_id", e.target.value)} placeholder="GTM-XXXXXXX" />
            </div>
            <div className="admin-form-group">
              <label>Meta (Facebook) Pixel Kimliği</label>
              <input className="admin-form-control" value={field("meta_pixel_id")} onChange={(e) => setField("meta_pixel_id", e.target.value)} placeholder="123456789012345" />
            </div>
            <button
              className="admin-btn admin-btn-primary"
              disabled={saving}
              onClick={() => saveFields(["ga_measurement_id", "gtm_container_id", "meta_pixel_id"])}
            >
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "contact" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>İletişim Sayfası İçeriği</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label>Giriş Metni</label>
              <textarea className="admin-form-control" value={field("contact_intro")} onChange={(e) => setField("contact_intro", e.target.value)} />
            </div>
            <div className="admin-form-group">
              <label>Çalışma Saatleri</label>
              <input className="admin-form-control" value={field("contact_hours")} onChange={(e) => setField("contact_hours", e.target.value)} placeholder="Hafta içi 09:00 - 18:00" />
            </div>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveFields(["contact_intro", "contact_hours"])}>
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "shipping" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Kargo Ayarları</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Kargo Ücreti (₺)</label>
                <input type="number" step="0.01" className="admin-form-control" value={field("shipping_cost")} onChange={(e) => setField("shipping_cost", e.target.value)} placeholder="49.90" />
              </div>
              <div className="admin-form-group">
                <label>Ücretsiz Kargo Limiti (₺)</label>
                <input type="number" step="0.01" className="admin-form-control" value={field("free_shipping_limit")} onChange={(e) => setField("free_shipping_limit", e.target.value)} placeholder="500" />
              </div>
            </div>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveFields(["shipping_cost", "free_shipping_limit"])}>
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "seo" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>SEO Ayarları</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label>Ana Sayfa Başlığı (Title)</label>
              <input className="admin-form-control" value={field("meta_title")} onChange={(e) => setField("meta_title", e.target.value)} placeholder="Gülüm Şalım - Kadın Giyim" />
            </div>
            <div className="admin-form-group">
              <label>Meta Açıklama</label>
              <textarea className="admin-form-control" value={field("meta_description")} onChange={(e) => setField("meta_description", e.target.value)} />
            </div>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveFields(["meta_title", "meta_description"])}>
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "social" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Sosyal Medya</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  <i className="fab fa-instagram" /> Instagram
                </label>
                <input className="admin-form-control" value={field("site_instagram")} onChange={(e) => setField("site_instagram", e.target.value)} placeholder="https://instagram.com/..." />
              </div>
              <div className="admin-form-group">
                <label>
                  <i className="fab fa-facebook" /> Facebook
                </label>
                <input className="admin-form-control" value={field("site_facebook")} onChange={(e) => setField("site_facebook", e.target.value)} placeholder="https://facebook.com/..." />
              </div>
            </div>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveFields(["site_instagram", "site_facebook"])}>
              <i className="fas fa-save" /> Kaydet
            </button>
          </div>
        </div>
      )}

      {tab === "profile" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Profil Bilgileri</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Ad Soyad</label>
                <input className="admin-form-control" value={profileFullName} onChange={(e) => setProfileFullName(e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>Kullanıcı Adı</label>
                <input className="admin-form-control" value={admin.username} disabled style={{ opacity: 0.6 }} />
              </div>
            </div>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={saveProfile}>
              <i className="fas fa-save" /> Güncelle
            </button>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Şifre Değiştir</h2>
          </div>
          <div className="admin-card-body">
            <div className="admin-form-group">
              <label>Mevcut Şifre</label>
              <input type="password" className="admin-form-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Yeni Şifre</label>
                <input type="password" className="admin-form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label>Yeni Şifre (Tekrar)</label>
                <input type="password" className="admin-form-control" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <button className="admin-btn admin-btn-danger" disabled={saving} onClick={savePassword}>
              <i className="fas fa-key" /> Şifreyi Değiştir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
