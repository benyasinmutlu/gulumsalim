"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminHomepageSection } from "@/lib/types";
import ProductPicker from "./product-picker";

const ALGO_OPTIONS: { value: string; label: string; usesProductIds?: boolean; usesLimit?: boolean; usesVendor?: boolean; usesPinExclude?: boolean }[] = [
  { value: "manual", label: "Elle Seçilmiş", usesProductIds: true },
  { value: "featured", label: "Öne Çıkanlar", usesProductIds: true },
  { value: "new_arrivals", label: "Yeni Gelenler", usesLimit: true, usesPinExclude: true },
  { value: "best_sellers", label: "Çok Satanlar", usesLimit: true, usesPinExclude: true },
  { value: "weekly_best", label: "Bu Haftanın En İyileri", usesLimit: true, usesPinExclude: true },
  { value: "vendor_carousel", label: "Mağaza Vitrini", usesLimit: true, usesVendor: true, usesPinExclude: true },
  { value: "recently_viewed", label: "Son Baktıklarınız", usesLimit: true },
  { value: "related_viewed", label: "Bunlarla İlgilenebilirsiniz", usesLimit: true, usesPinExclude: true },
  { value: "discover_personalized", label: "Kişiselleştirilmiş (Keşfet)", usesLimit: true, usesPinExclude: true },
];

function algoMeta(value: string) {
  return ALGO_OPTIONS.find((o) => o.value === value) ?? ALGO_OPTIONS[0]!;
}

interface SectionConfig {
  productIds?: number[];
  pinnedProductIds?: number[];
  excludedProductIds?: number[];
  limit?: number;
  vendorId?: number;
  subtitle?: string;
  titleColor?: string;
}

export default function SectionsManager() {
  const [sections, setSections] = useState<AdminHomepageSection[] | null>(null);
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
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setSections(await fetchJson<AdminHomepageSection[]>("/admin/homepage-sections"));
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

    setLoading(true);
    try {
      if (editing) {
        await mutateJson(`/admin/homepage-sections/${editing.id}`, "PATCH", { title, algoType, config, sortOrder });
      } else {
        await mutateJson("/admin/homepage-sections", "POST", { title, algoType, config, sortOrder });
      }
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(section: AdminHomepageSection) {
    await mutateJson(`/admin/homepage-sections/${section.id}`, "PATCH", { isActive: !section.isActive });
    await load();
  }

  async function moveSection(index: number, dir: -1 | 1) {
    if (!sections) return;
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[index]!;
    const b = sections[target]!;
    await Promise.all([
      mutateJson(`/admin/homepage-sections/${a.id}`, "PATCH", { sortOrder: b.sortOrder }),
      mutateJson(`/admin/homepage-sections/${b.id}`, "PATCH", { sortOrder: a.sortOrder }),
    ]);
    await load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu bölüm silinsin mi?")) return;
    await mutateJson(`/admin/homepage-sections/${id}`, "DELETE");
    if (editing?.id === id) startNew();
    await load();
  }

  const meta = algoMeta(algoType);

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Anasayfa Bölümleri</h2>
        </div>
        {sections === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : sections.length === 0 ? (
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
                {sections.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ padding: "0 6px" }}>
                          <i className="fas fa-caret-up" />
                        </button>
                        <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ padding: "0 6px" }}>
                          <i className="fas fa-caret-down" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); startEdit(s); }}>
                        {s.title}
                      </a>
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>{algoMeta(s.algoType).label}</td>
                    <td>
                      <button
                        className={`admin-badge ${s.isActive ? "admin-badge-active" : "admin-badge-inactive"}`}
                        onClick={() => toggleActive(s)}
                        style={{ cursor: "pointer", border: "none" }}
                      >
                        {s.isActive ? "Aktif" : "Pasif"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(s.id)}>
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
  );
}
