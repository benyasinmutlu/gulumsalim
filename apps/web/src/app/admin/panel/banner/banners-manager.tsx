"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminPromoBanner, AdminPromoBannerImage } from "@/lib/types";
import ImageDropPreview from "@/components/image-drop-preview";

interface BannerFormState {
  title: string;
  linkType: "url" | "category" | "vendor" | "all_vendors" | "collection";
  linkUrl: string;
  animStyle: string;
  subtitle: string;
  buttonText: string;
  textColor: string;
  rotateSeconds: string;
}

interface BannerStats {
  totalViews: number;
  totalClicks: number;
  dailyClicks: { date: string; count: number }[];
  scope: { label: string; productCount: number; favoriteCount: number; purchaseCount: number } | null;
}

const EMPTY_FORM: BannerFormState = {
  title: "",
  linkType: "url",
  linkUrl: "",
  animStyle: "fade-up",
  subtitle: "",
  buttonText: "",
  textColor: "#ffffff",
  rotateSeconds: "4",
};

const LINK_TYPE_OPTIONS: { value: BannerFormState["linkType"]; label: string }[] = [
  { value: "url", label: "Adres (URL)" },
  { value: "category", label: "Kategori" },
  { value: "vendor", label: "Mağaza" },
  { value: "all_vendors", label: "Tüm Mağazalar" },
  { value: "collection", label: "Koleksiyon" },
];

const ANIM_STYLE_OPTIONS = [
  { value: "none", label: "Animasyon Yok" },
  { value: "fade-up", label: "Yukarı Kayarak Belirme" },
  { value: "zoom-in", label: "Yakınlaşarak Belirme" },
  { value: "slide-left", label: "Sağdan Kayarak Belirme" },
  { value: "fade", label: "Sade Belirme" },
];

// "all_vendors" tek bir varlığa bağlı değil (bkz. content.repository.ts
// resolveCollectionLink) - o türde linkUrl alanı hiç gösterilmez.
function linkValueLabel(linkType: BannerFormState["linkType"]) {
  if (linkType === "category") return "Kategori Slug";
  if (linkType === "vendor") return "Mağaza Slug";
  if (linkType === "collection") return "Mağaza Slug/Koleksiyon Slug (ör. bulteen-2/yaz-kreasyonu)";
  return "Tıklanınca gidilecek adres";
}

export default function BannersManager() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BannerFormState>(EMPTY_FORM);
  const [extraImages, setExtraImages] = useState<AdminPromoBannerImage[]>([]);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [statsFor, setStatsFor] = useState<number | null>(null);
  const [stats, setStats] = useState<BannerStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);

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
      const params = new URLSearchParams({ title: form.title, linkType: form.linkType, animStyle: form.animStyle });
      if (form.linkUrl) params.set("linkUrl", form.linkUrl);
      if (form.subtitle) params.set("subtitle", form.subtitle);
      if (form.buttonText) params.set("buttonText", form.buttonText);
      if (form.textColor) params.set("textColor", form.textColor);
      if (form.rotateSeconds) params.set("rotateSeconds", form.rotateSeconds);
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

  async function startEdit(banner: AdminPromoBanner) {
    setEditingId(banner.id);
    setStatsFor(null);
    setEditForm({
      title: banner.title,
      linkType: banner.linkType ?? "url",
      linkUrl: banner.linkUrl ?? "",
      animStyle: banner.animStyle ?? "fade-up",
      subtitle: banner.subtitle ?? "",
      buttonText: banner.buttonText ?? "",
      textColor: banner.textColor ?? "#ffffff",
      rotateSeconds: String(banner.rotateSeconds ?? 4),
    });
    setExtraImages(await fetchJson<AdminPromoBannerImage[]>(`/admin/promo-banners/${banner.id}/images`));
  }

  async function saveEdit(id: number) {
    await mutateJson(`/admin/promo-banners/${id}`, "PATCH", {
      title: editForm.title,
      linkType: editForm.linkType,
      linkUrl: editForm.linkUrl || undefined,
      animStyle: editForm.animStyle,
      subtitle: editForm.subtitle || undefined,
      buttonText: editForm.buttonText || undefined,
      textColor: editForm.textColor || undefined,
      rotateSeconds: editForm.rotateSeconds ? Number(editForm.rotateSeconds) : undefined,
    });
    setEditingId(null);
    await load();
  }

  async function handleExtraImageUpload(id: number) {
    const files = extraFileInputRef.current?.files;
    if (!files || files.length === 0) return;
    setUploadingExtra(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(`/admin/promo-banners/${id}/images`, file);
      }
      if (extraFileInputRef.current) extraFileInputRef.current.value = "";
      setExtraImages(await fetchJson<AdminPromoBannerImage[]>(`/admin/promo-banners/${id}/images`));
    } finally {
      setUploadingExtra(false);
    }
  }

  async function removeExtraImage(bannerId: number, imageId: number) {
    if (!confirm("Bu döngü görseli silinsin mi?")) return;
    await mutateJson(`/admin/promo-banners/${bannerId}/images/${imageId}`, "DELETE");
    setExtraImages(await fetchJson<AdminPromoBannerImage[]>(`/admin/promo-banners/${bannerId}/images`));
  }

  async function toggleStats(id: number) {
    if (statsFor === id) {
      setStatsFor(null);
      setStats(null);
      return;
    }
    setEditingId(null);
    setStatsFor(id);
    setStats(null);
    setStats(await fetchJson<BannerStats>(`/admin/promo-banners/${id}/stats`));
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
            <ImageDropPreview
              inputRef={fileInputRef}
              className="admin-file-drop"
              label="Banner görseli"
              hint="JPG, PNG, WEBP, GIF"
              accept="image/jpeg,image/png,image/webp,image/gif"
            />
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
              <label>Hedef Türü</label>
              <select
                className="admin-form-control"
                value={form.linkType}
                onChange={(e) => setForm({ ...form, linkType: e.target.value as BannerFormState["linkType"] })}
              >
                {LINK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {form.linkType !== "all_vendors" && (
            <div className="admin-form-group">
              <label>{linkValueLabel(form.linkType)}</label>
              <input
                className="admin-form-control"
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder={form.linkType === "url" ? "/urunler" : form.linkType === "collection" ? "bulteen-2/yaz-kreasyonu" : "ör. kadin-giyim"}
              />
            </div>
          )}
          <div className="admin-form-group">
            <label>Görünme Animasyonu</label>
            <select className="admin-form-control" value={form.animStyle} onChange={(e) => setForm({ ...form, animStyle: e.target.value })}>
              {ANIM_STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-row">
            <div className="admin-form-group">
              <label>Metin Rengi</label>
              <input className="admin-form-control" type="color" value={form.textColor} onChange={(e) => setForm({ ...form, textColor: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label>Döngü Süresi (sn)</label>
              <input
                className="admin-form-control"
                type="number"
                min={1}
                value={form.rotateSeconds}
                onChange={(e) => setForm({ ...form, rotateSeconds: e.target.value })}
                title="Ek görsel eklenirse görseller arası geçiş süresi"
              />
            </div>
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
                    <select
                      className="admin-form-control"
                      value={editForm.linkType}
                      onChange={(e) => setEditForm({ ...editForm, linkType: e.target.value as BannerFormState["linkType"] })}
                    >
                      {LINK_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {editForm.linkType !== "all_vendors" && (
                      <input
                        className="admin-form-control"
                        placeholder={linkValueLabel(editForm.linkType)}
                        value={editForm.linkUrl}
                        onChange={(e) => setEditForm({ ...editForm, linkUrl: e.target.value })}
                      />
                    )}
                    <select
                      className="admin-form-control"
                      value={editForm.animStyle}
                      onChange={(e) => setEditForm({ ...editForm, animStyle: e.target.value })}
                    >
                      {ANIM_STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="admin-form-control"
                      type="number"
                      min={1}
                      placeholder="Döngü süresi (sn)"
                      value={editForm.rotateSeconds}
                      onChange={(e) => setEditForm({ ...editForm, rotateSeconds: e.target.value })}
                    />

                    <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: 4 }}>Ek Görseller (döngü için)</div>
                    {extraImages.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {extraImages.map((ei) => (
                          <div key={ei.id} style={{ position: "relative", width: 48, height: 48 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ei.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--admin-border)" }} />
                            <button
                              type="button"
                              onClick={() => removeExtraImage(b.id, ei.id)}
                              title="Sil"
                              style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, fontSize: 9, borderRadius: "50%", border: "none", background: "var(--admin-error)", color: "#fff", cursor: "pointer" }}
                            >
                              <i className="fas fa-times" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="admin-file-drop">
                      <input ref={extraFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={() => handleExtraImageUpload(b.id)} disabled={uploadingExtra} />
                      <i className="fas fa-images" />
                      <p>{uploadingExtra ? "Yükleniyor..." : "Döngü görseli ekle"}</p>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ flex: 1 }} onClick={() => saveEdit(b.id)}>
                        Kaydet
                      </button>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setEditingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : statsFor === b.id ? (
                  <BannerStatsPanel stats={stats} onClose={() => toggleStats(b.id)} />
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
                      <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => toggleStats(b.id)} title="İstatistikler">
                        <i className="fas fa-chart-line" />
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

// admin/promo-banners.php'deki tıklama-istatistik panelinin karşılığı -
// toplam + son 14 gün tıklama grafiği, ve banner bir kategoriye/mağazaya
// bağlıysa o kapsamdaki favori/satış korelasyonu.
function BannerStatsPanel({ stats, onClose }: { stats: BannerStats | null; onClose: () => void }) {
  if (!stats) {
    return (
      <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>Yükleniyor...</div>
    );
  }
  const maxDaily = Math.max(1, ...stats.dailyClicks.map((d) => d.count));
  return (
    <div style={{ marginTop: "0.5rem", padding: "0.6rem", background: "var(--admin-bg-alt, rgba(0,0,0,.03))", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: "1.2rem" }}>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{stats.totalViews}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)" }}>Görüntülenme</div>
          </div>
          <div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{stats.totalClicks}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)" }}>Tıklama</div>
          </div>
        </div>
        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={onClose}>
          Kapat
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40, marginTop: "0.6rem" }}>
        {stats.dailyClicks.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} tıklama`}
            style={{
              flex: 1,
              height: `${Math.max(4, (d.count / maxDaily) * 40)}px`,
              background: d.count > 0 ? "var(--admin-primary)" : "var(--admin-border)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--admin-text-muted)", marginTop: 4 }}>Son 14 gün</div>

      {stats.scope ? (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--admin-border)", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>
            <i className="fas fa-link" /> Bağlı kapsam: {stats.scope.label}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.7rem", color: "var(--admin-text-muted)" }}>
            <span>{stats.scope.productCount} ürün</span>
            <span>{stats.scope.favoriteCount} favori</span>
            <span>{stats.scope.purchaseCount} satış</span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "0.6rem", fontSize: "0.7rem", color: "var(--admin-text-muted)" }}>
          Bu banner bir kategori/mağazaya bağlı değil, kapsam korelasyonu yok.
        </div>
      )}
    </div>
  );
}
