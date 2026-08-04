"use client";

import { useEffect, useRef, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { AdminPromoBanner } from "@/lib/types";
import ImageDropPreview from "@/components/image-drop-preview";

interface BannerFormState {
  title: string;
  linkType: "url" | "category" | "vendor";
  linkUrl: string;
  animStyle: string;
  subtitle: string;
  buttonText: string;
  textColor: string;
}

const EMPTY_FORM: BannerFormState = { title: "", linkType: "url", linkUrl: "", animStyle: "fade-up", subtitle: "", buttonText: "", textColor: "#ffffff" };

const LINK_TYPE_OPTIONS: { value: BannerFormState["linkType"]; label: string }[] = [
  { value: "url", label: "Adres (URL)" },
  { value: "category", label: "Kategori" },
  { value: "vendor", label: "Mağaza" },
];

const ANIM_STYLE_OPTIONS = [
  { value: "none", label: "Animasyon Yok" },
  { value: "fade-up", label: "Yukarı Kayarak Belirme" },
  { value: "zoom-in", label: "Yakınlaşarak Belirme" },
  { value: "slide-left", label: "Sağdan Kayarak Belirme" },
  { value: "fade", label: "Sade Belirme" },
];

function linkValueLabel(linkType: BannerFormState["linkType"]) {
  if (linkType === "category") return "Kategori Slug";
  if (linkType === "vendor") return "Mağaza Slug";
  return "Tıklanınca gidilecek adres";
}

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

interface BannerStats {
  totalViews: number;
  totalClicks: number;
  dailyClicks: { date: string; count: number }[];
  scope: { label: string; productCount: number; favoriteCount: number; purchaseCount: number } | null;
}

// gulumsalim.com'daki vendor/promo-banners.php'nin karşılığı - satıcı
// kendi kampanya bannerını oluşturur, admin onayından sonra anasayfada
// yayınlanır (bkz. admin/panel/banner/banners-manager.tsx'teki onay/red).
export default function BannersManager() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statsFor, setStatsFor] = useState<number | null>(null);
  const [stats, setStats] = useState<BannerStats | null>(null);

  async function load() {
    setBanners(await fetchJson<AdminPromoBanner[]>("/vendor/promo-banners"));
  }

  async function toggleStats(id: number) {
    if (statsFor === id) {
      setStatsFor(null);
      setStats(null);
      return;
    }
    setStatsFor(id);
    setStats(null);
    setStats(await fetchJson<BannerStats>(`/vendor/promo-banners/${id}/stats`));
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
        {/* Eski maxWidth:480 tüm formu dar sol şeride sıkıştırıyordu (UI bug).
            Alanlar row2 çiftleriyle genişçe yayıldı; renk seçici .fi'siz düzgün
            boyutlandırıldı (type=color + .fi ince bir çizgi gibi bozuluyordu). */}
        <div className="card-body" style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div className="row2">
            <div className="fg">
              <label>Başlık</label>
              <input className="fi" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="fg">
              <label>Alt Başlık (opsiyonel)</label>
              <input className="fi" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
          </div>
          <div className="fg">
            <label>Görsel</label>
            <ImageDropPreview
              inputRef={fileInputRef}
              label="Banner görseli"
              hint="JPG, PNG, WEBP, GIF"
              accept="image/jpeg,image/png,image/webp,image/gif"
            />
          </div>
          <div className="row2">
            <div className="fg">
              <label>Buton Metni</label>
              <input className="fi" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} />
            </div>
            <div className="fg">
              <label>Hedef Türü</label>
              <select className="fi" value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value as BannerFormState["linkType"] })}>
                {LINK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="fg">
              <label>{linkValueLabel(form.linkType)}</label>
              <input
                className="fi"
                value={form.linkUrl}
                onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                placeholder={form.linkType === "url" ? "/urunler" : "ör. kadin-giyim"}
              />
            </div>
            <div className="fg">
              <label>Görünme Animasyonu</label>
              <select className="fi" value={form.animStyle} onChange={(e) => setForm({ ...form, animStyle: e.target.value })}>
                {ANIM_STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="fg">
            <label>Metin Rengi</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={form.textColor}
                onChange={(e) => setForm({ ...form, textColor: e.target.value })}
                style={{ width: 56, height: 40, padding: 3, border: "1.5px solid var(--br)", borderRadius: 10, background: "var(--s2)", cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: "var(--tx3)", fontFamily: "monospace" }}>{form.textColor}</span>
            </div>
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
                {statsFor === b.id ? (
                  <BannerStatsPanel stats={stats} onClose={() => toggleStats(b.id)} />
                ) : (
                  <div style={{ marginTop: "0.4rem", display: "flex", gap: "0.4rem" }}>
                    <button className="btn btn-sec btn-sm" onClick={() => toggleStats(b.id)}>
                      <i className="fas fa-chart-line" /> İstatistik
                    </button>
                    <button className="btn btn-sec btn-sm" onClick={() => remove(b.id)}>
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

// bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı kaç kişi tıkladı o
// tıkladığı kampanyadan herhangi bir ürünü aldıysa veya favoriye
// eklediyse de göster" - admin/panel/banner/banners-manager.tsx'teki aynı
// panel, satıcı panelinin CSS sınıflarıyla.
function BannerStatsPanel({ stats, onClose }: { stats: BannerStats | null; onClose: () => void }) {
  if (!stats) {
    return <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--tx3)" }}>Yükleniyor...</div>;
  }
  const maxDaily = Math.max(1, ...stats.dailyClicks.map((d) => d.count));
  return (
    <div style={{ marginTop: "0.5rem", padding: "0.6rem", background: "var(--s2)", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{stats.totalViews}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--tx3)" }}>Görüntülenme</div>
          </div>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{stats.totalClicks}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--tx3)" }}>Tıklama</div>
          </div>
        </div>
        <button className="btn btn-sec btn-sm" onClick={onClose}>
          Kapat
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 36, marginTop: "0.6rem" }}>
        {stats.dailyClicks.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} tıklama`}
            style={{
              flex: 1,
              height: `${Math.max(4, (d.count / maxDaily) * 36)}px`,
              background: d.count > 0 ? "var(--pr)" : "var(--br)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: "0.62rem", color: "var(--tx3)", marginTop: 4 }}>Son 14 gün (tıklama)</div>

      {stats.scope ? (
        <div style={{ marginTop: "0.6rem", borderTop: "1px solid var(--br)", paddingTop: "0.5rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, marginBottom: 4 }}>
            <i className="fas fa-link" /> Bağlı kapsam: {stats.scope.label}
          </div>
          <div style={{ display: "flex", gap: "0.6rem", fontSize: "0.68rem", color: "var(--tx3)" }}>
            <span>{stats.scope.productCount} ürün</span>
            <span>{stats.scope.favoriteCount} favori</span>
            <span>{stats.scope.purchaseCount} satış</span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "0.6rem", fontSize: "0.68rem", color: "var(--tx3)" }}>
          Bu banner bir kategori/mağazaya bağlı değil, kapsam korelasyonu yok.
        </div>
      )}
    </div>
  );
}
