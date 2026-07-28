"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminHomepageCollection, AdminHomepageSection } from "@/lib/types";
import ProductPicker from "./product-picker";
import SectionBannersManager from "./section-banners-manager";

const ALGO_OPTIONS: { value: string; label: string; usesProductIds?: boolean; usesLimit?: boolean; usesVendor?: boolean; usesPinExclude?: boolean; usesBanners?: boolean }[] = [
  { value: "manual", label: "Elle Seçilmiş", usesProductIds: true },
  { value: "featured", label: "Öne Çıkanlar", usesProductIds: true },
  { value: "new_arrivals", label: "Yeni Gelenler", usesLimit: true, usesPinExclude: true },
  { value: "best_sellers", label: "Çok Satanlar", usesLimit: true, usesPinExclude: true },
  { value: "weekly_best", label: "Bu Haftanın En İyileri", usesLimit: true, usesPinExclude: true },
  { value: "vendor_carousel", label: "Mağaza Vitrini (Kayan Kartlar)", usesLimit: true, usesVendor: true, usesPinExclude: true },
  { value: "vendor_products", label: "Seçili Mağazanın Ürünleri", usesLimit: true, usesVendor: true },
  { value: "promo_banners", label: "Kampanya Bannerları", usesBanners: true },
  { value: "recently_viewed", label: "Son Baktıklarınız", usesLimit: true },
  { value: "related_viewed", label: "Bunlarla İlgilenebilirsiniz", usesLimit: true, usesPinExclude: true },
  { value: "discover_personalized", label: "Kişiselleştirilmiş (Keşfet)", usesLimit: true, usesPinExclude: true },
];

const FONT_OPTIONS = [
  { value: "display", label: "Klasik (Serif)" },
  { value: "sans", label: "Modern (Kalın Sans)" },
  { value: "italic", label: "Zarif (İtalik)" },
];

const ANIM_OPTIONS = [
  { value: "fade-up", label: "Yukarı Kayarak Belirme" },
  { value: "zoom-in", label: "Yakınlaşarak Belirme" },
  { value: "slide-left", label: "Sağdan Kayarak Belirme" },
  { value: "fade", label: "Sade Belirme" },
];

const BG_OPTIONS = [
  { value: "plain", label: "Düz Arkaplan" },
  { value: "alt", label: "Alternatif (Gri) Arkaplan" },
];

function algoMeta(value: string) {
  return ALGO_OPTIONS.find((o) => o.value === value) ?? ALGO_OPTIONS[0]!;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface SectionConfig {
  productIds?: number[];
  pinnedProductIds?: number[];
  excludedProductIds?: number[];
  limit?: number;
  vendorId?: number;
  subtitle?: string;
  titleColor?: string;
  titleFont?: string;
  animStyle?: string;
  bgStyle?: string;
  subtitleColor?: string;
  bgColor?: string;
  bannerLayout?: string;
  showTitle?: boolean;
}

// bkz. kullanıcı isteği: "kampanyaları ve koleksiyonları anasayfa
// bölümleri arasında istediği gibi yerleştirebilsin sıralasın ... buradaki
// düzen tam olarak anasayfanın sıralama olarak birebir aynısı olmalı" -
// anasayfa koleksiyonları (homepage_collections) önceden BAMBAŞKA bir
// yönetim sayfasında, TAMAMEN AYRI bir sıra numarası uzayında yaşıyordu ve
// gerçek anasayfada her zaman tüm bölümlerden SONRA sabit bir blok olarak
// render ediliyordu - burada hiç görünmüyor, sıralanamıyordu. Artık bu
// liste bölümlerle BİRLEŞİK tek bir sıralı tabloda gösteriliyor; her
// sürükle-bırak/yukarı-aşağı hareketi TÜM listenin (bölüm+koleksiyon)
// sortOrder'ını 0..n baştan yazıyor, böylece buradaki sıra ile
// anasayfadaki sıra matematiksel olarak asla ayrışamaz.
type MergedItem =
  | { kind: "section"; id: number; sortOrder: number; section: AdminHomepageSection }
  | { kind: "collection"; id: number; sortOrder: number; collection: AdminHomepageCollection };

export default function SectionsManager() {
  const [sections, setSections] = useState<AdminHomepageSection[] | null>(null);
  const [collections, setCollections] = useState<AdminHomepageCollection[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<AdminHomepageSection | null>(null);
  const [title, setTitle] = useState("");
  const [algoType, setAlgoType] = useState(ALGO_OPTIONS[0]!.value);
  const [productIds, setProductIds] = useState<number[]>([]);
  const [pinnedProductIds, setPinnedProductIds] = useState<number[]>([]);
  const [excludedProductIds, setExcludedProductIds] = useState<number[]>([]);
  const [limit, setLimit] = useState(8);
  const [vendorId, setVendorId] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [titleColor, setTitleColor] = useState("");
  const [titleFont, setTitleFont] = useState("display");
  const [animStyle, setAnimStyle] = useState("fade-up");
  const [bgStyle, setBgStyle] = useState("plain");
  const [subtitleColor, setSubtitleColor] = useState("");
  const [bgColor, setBgColor] = useState("");
  const [bannerLayout, setBannerLayout] = useState("grid");
  const [showTitle, setShowTitle] = useState(false);
  const [seoSlug, setSeoSlug] = useState("");
  const [seoSlugTouched, setSeoSlugTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [sectionRows, collectionRows] = await Promise.all([
      fetchJson<AdminHomepageSection[]>("/admin/homepage-sections"),
      fetchJson<AdminHomepageCollection[]>("/admin/homepage-collections"),
    ]);
    setSections(sectionRows);
    setCollections(collectionRows);
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing(null);
    setTitle("");
    setAlgoType(ALGO_OPTIONS[0]!.value);
    setProductIds([]);
    setPinnedProductIds([]);
    setExcludedProductIds([]);
    setLimit(8);
    setVendorId("");
    setSubtitle("");
    setTitleColor("");
    setTitleFont("display");
    setAnimStyle("fade-up");
    setBgStyle("plain");
    setSubtitleColor("");
    setBgColor("");
    setBannerLayout("grid");
    setShowTitle(false);
    setSeoSlug("");
    setSeoSlugTouched(false);
    setSortOrder((sections?.length ?? 0) * 10);
    setError(null);
  }

  function startEdit(section: AdminHomepageSection) {
    const config = (section.config ?? {}) as SectionConfig;
    setEditing(section);
    setTitle(section.title);
    setAlgoType(section.algoType);
    setProductIds(config.productIds ?? []);
    setPinnedProductIds(config.pinnedProductIds ?? []);
    setExcludedProductIds(config.excludedProductIds ?? []);
    setLimit(config.limit ?? 8);
    setVendorId(config.vendorId ? String(config.vendorId) : "");
    setSubtitle(config.subtitle ?? "");
    setTitleColor(config.titleColor ?? "");
    setTitleFont(config.titleFont ?? "display");
    setAnimStyle(config.animStyle ?? "fade-up");
    setBgStyle(config.bgStyle ?? "plain");
    setSubtitleColor(config.subtitleColor ?? "");
    setBgColor(config.bgColor ?? "");
    setBannerLayout(config.bannerLayout ?? "grid");
    setShowTitle(config.showTitle ?? false);
    setSeoSlug(section.seoSlug ?? "");
    setSeoSlugTouched(true);
    setSortOrder(section.sortOrder);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const meta = algoMeta(algoType);
    const config: SectionConfig = {};
    if (meta.usesProductIds) config.productIds = productIds;
    if (meta.usesLimit) config.limit = limit;
    if (meta.usesVendor && vendorId) config.vendorId = Number(vendorId);
    if (meta.usesPinExclude) {
      if (pinnedProductIds.length) config.pinnedProductIds = pinnedProductIds;
      if (excludedProductIds.length) config.excludedProductIds = excludedProductIds;
    }
    if (subtitle) config.subtitle = subtitle;
    if (titleColor) config.titleColor = titleColor;
    if (titleFont !== "display") config.titleFont = titleFont;
    if (animStyle !== "fade-up") config.animStyle = animStyle;
    if (bgStyle !== "plain") config.bgStyle = bgStyle;
    if (subtitleColor) config.subtitleColor = subtitleColor;
    if (bgColor) config.bgColor = bgColor;
    if (meta.usesBanners && bannerLayout !== "grid") config.bannerLayout = bannerLayout;
    if (meta.usesBanners) config.showTitle = showTitle;

    setLoading(true);
    try {
      if (editing) {
        await mutateJson(`/admin/homepage-sections/${editing.id}`, "PATCH", {
          title,
          algoType,
          config,
          sortOrder,
          seoSlug: seoSlug || null,
        });
      } else {
        await mutateJson("/admin/homepage-sections", "POST", {
          title,
          algoType,
          config,
          sortOrder,
          seoSlug: seoSlug || undefined,
        });
      }
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(item: MergedItem) {
    if (item.kind === "section") {
      await mutateJson(`/admin/homepage-sections/${item.id}`, "PATCH", { isActive: !item.section.isActive });
    } else {
      await mutateJson(`/admin/homepage-collections/${item.id}`, "PATCH", { isActive: !item.collection.isActive });
    }
    await load();
  }

  function persistItemOrder(item: MergedItem, sortOrder: number) {
    return item.kind === "section"
      ? mutateJson(`/admin/homepage-sections/${item.id}`, "PATCH", { sortOrder })
      : mutateJson(`/admin/homepage-collections/${item.id}`, "PATCH", { sortOrder });
  }

  async function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= mergedItems.length) return;
    const reordered = [...mergedItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved!);
    await Promise.all(reordered.map((item, i) => persistItemOrder(item, i)));
    await load();
  }

  // homepage-sections.php'deki sürükle-bırak sıralamanın karşılığı - yukarı/
  // aşağı oklar yerine tüm listeyi (bölüm + koleksiyon karışık) tek
  // harekette yeniden sıralar.
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...mergedItems];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved!);
    setDragIndex(null);
    setDragOverIndex(null);

    await Promise.all(reordered.map((item, i) => persistItemOrder(item, i)));
    await load();
  }

  async function handleDelete(item: MergedItem) {
    if (item.kind === "section") {
      if (!confirm("Bu bölüm silinsin mi?")) return;
      await mutateJson(`/admin/homepage-sections/${item.id}`, "DELETE");
      if (editing?.id === item.id) startNew();
    } else {
      if (!confirm("Bu koleksiyon silinsin mi?")) return;
      await mutateJson(`/admin/homepage-collections/${item.id}`, "DELETE");
    }
    await load();
  }

  const meta = algoMeta(algoType);
  const mergedItems: MergedItem[] = [
    ...(sections ?? []).map((s): MergedItem => ({ kind: "section", id: s.id, sortOrder: s.sortOrder, section: s })),
    ...(collections ?? []).map((c): MergedItem => ({ kind: "collection", id: c.id, sortOrder: c.sortOrder, collection: c })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="hs-manager-layout">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Anasayfa Bölümleri</h2>
        </div>
        {sections === null || collections === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : mergedItems.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-th-large" />
            <h3>Henüz bölüm yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Başlık</th>
                  <th>Tür</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mergedItems.map((item, i) => (
                  <tr
                    key={`${item.kind}-${item.id}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(i, e)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    style={{
                      opacity: dragIndex === i ? 0.4 : 1,
                      borderTop: dragOverIndex === i && dragIndex !== null && dragIndex !== i ? "2px solid var(--admin-primary)" : undefined,
                      cursor: "grab",
                    }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <i className="fas fa-grip-vertical" style={{ color: "var(--admin-text-muted)", cursor: "grab" }} title="Sürükleyerek sırala" />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ padding: "0 6px" }}>
                            <i className="fas fa-caret-up" />
                          </button>
                          <button type="button" onClick={() => moveItem(i, 1)} disabled={i === mergedItems.length - 1} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ padding: "0 6px" }}>
                            <i className="fas fa-caret-down" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.kind === "section" ? (
                        <>
                          <a href="#" onClick={(e) => { e.preventDefault(); startEdit(item.section); }}>
                            {item.section.title}
                          </a>
                          {item.section.seoSlug && <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>/{item.section.seoSlug}</div>}
                        </>
                      ) : (
                        <>
                          <Link href="/admin/panel/anasayfa-koleksiyonlari">{item.collection.title}</Link>
                          <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>İçerik ve ürünler için Anasayfa Koleksiyonları sayfasını kullanın</div>
                        </>
                      )}
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>
                      {item.kind === "section" ? algoMeta(item.section.algoType).label : "Koleksiyon"}
                    </td>
                    <td>
                      <button
                        className={`admin-badge ${(item.kind === "section" ? item.section.isActive : item.collection.isActive) ? "admin-badge-active" : "admin-badge-inactive"}`}
                        onClick={() => toggleActive(item)}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        {(item.kind === "section" ? item.section.isActive : item.collection.isActive) ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(item)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="hs-editor-column">
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>{editing ? `"${editing.title}" düzenleniyor` : "Yeni Bölüm"}</h2>
          </div>
        <form className="admin-card-body" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Başlık</label>
            <input className="admin-form-control" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Alt Başlık (opsiyonel)</label>
            <input className="admin-form-control" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Başlık Rengi (opsiyonel)</label>
            <input type="color" className="admin-form-control" value={titleColor || "#2D2D2D"} onChange={(e) => setTitleColor(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Alt Başlık Rengi (opsiyonel)</label>
            <input type="color" className="admin-form-control" value={subtitleColor || "#7A7A7A"} onChange={(e) => setSubtitleColor(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Başlık Fontu</label>
            <select className="admin-form-control" value={titleFont} onChange={(e) => setTitleFont(e.target.value)}>
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label>Görünme Animasyonu</label>
            <select className="admin-form-control" value={animStyle} onChange={(e) => setAnimStyle(e.target.value)}>
              {ANIM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label>Arkaplan Stili</label>
            <select className="admin-form-control" value={bgStyle} onChange={(e) => setBgStyle(e.target.value)}>
              {BG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="admin-form-group">
            <label>Arkaplan Rengi (opsiyonel, stil üzerine geçer)</label>
            <input type="color" className="admin-form-control" value={bgColor || "#ffffff"} onChange={(e) => setBgColor(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>SEO Adresi (opsiyonel — /{seoSlug || "bolum-adresi"} olarak yayınlanır)</label>
            <input
              className="admin-form-control"
              value={seoSlug}
              onChange={(e) => { setSeoSlugTouched(true); setSeoSlug(slugify(e.target.value)); }}
              onBlur={() => { if (!seoSlugTouched && title) setSeoSlug(slugify(title)); }}
              placeholder={title ? slugify(title) : "bolum-adresi"}
            />
          </div>
          <div className="admin-form-group">
            <label>Tür</label>
            <select className="admin-form-control" value={algoType} onChange={(e) => setAlgoType(e.target.value)}>
              {ALGO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {meta.usesLimit && (
            <div className="admin-form-group">
              <label>Ürün Sayısı</label>
              <input className="admin-form-control" type="number" min={1} max={24} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </div>
          )}
          {meta.usesVendor && (
            <div className="admin-form-group">
              <label>Satıcı ID</label>
              <input className="admin-form-control" type="number" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Mağaza vitrini için satıcı ID" />
            </div>
          )}

          {meta.usesProductIds && <ProductPicker label="Ürünler (sırayla gösterilir)" ids={productIds} onChange={setProductIds} reorderable />}
          {meta.usesPinExclude && (
            <>
              <ProductPicker label="Sabitlenecek Ürünler (listenin başında gösterilir)" ids={pinnedProductIds} onChange={setPinnedProductIds} reorderable />
              <ProductPicker label="Hariç Tutulacak Ürünler" ids={excludedProductIds} onChange={setExcludedProductIds} />
            </>
          )}

          {meta.usesBanners && (
            <>
              <div className="admin-form-group">
                <label>Banner Düzeni</label>
                <select className="admin-form-control" value={bannerLayout} onChange={(e) => setBannerLayout(e.target.value)}>
                  <option value="grid">Yan Yana (Grid)</option>
                  <option value="stack">Alt Alta</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
                  Başlığı Göster
                </label>
              </div>
              {editing && <SectionBannersManager sectionId={editing.id} />}
              {!editing && (
                <p style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                  Bölüme özel banner seçimi için önce bölümü kaydedin.
                </p>
              )}
            </>
          )}

          <div className="admin-form-group">
            <label>Sıra</label>
            <input className="admin-form-control" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
          </div>
          {error && <p className="error-text" style={{ color: "var(--admin-error)" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="admin-btn admin-btn-primary" type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : editing ? "Güncelle" : "Oluştur"}
            </button>
            {editing && (
              <button type="button" className="admin-btn admin-btn-secondary" onClick={startNew}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
        </div>
      </div>

    </div>
  );
}
