"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminPromoBanner } from "@/lib/types";

// homepage-sections.php'deki "Kampanya Bannerları" bölümüne özel banner
// seçimi/sıralamasının karşılığı - burada seçim hemen kaydedilir (section
// zaten var olmalı), form taslağının aksine ürün seçici gibi ertelenmez.
export default function SectionBannersManager({ sectionId }: { sectionId: number }) {
  const [selected, setSelected] = useState<AdminPromoBanner[] | null>(null);
  const [allBanners, setAllBanners] = useState<AdminPromoBanner[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function load() {
    setSelected(await fetchJson<AdminPromoBanner[]>(`/admin/homepage-sections/${sectionId}/banners`));
  }

  useEffect(() => {
    load();
    fetchJson<AdminPromoBanner[]>("/admin/promo-banners").then(setAllBanners);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  async function add(bannerId: number) {
    await mutateJson(`/admin/homepage-sections/${sectionId}/banners`, "POST", { bannerId });
    await load();
  }

  async function remove(bannerId: number) {
    await mutateJson(`/admin/homepage-sections/${sectionId}/banners/${bannerId}`, "DELETE");
    await load();
  }

  async function move(index: number, dir: -1 | 1) {
    if (!selected) return;
    const next = [...selected];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setSelected(next);
    await mutateJson(`/admin/homepage-sections/${sectionId}/banners/reorder`, "POST", { bannerIds: next.map((b) => b.id) });
  }

  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || !selected || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...selected];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved!);
    setSelected(next);
    setDragIndex(null);
    await mutateJson(`/admin/homepage-sections/${sectionId}/banners/reorder`, "POST", { bannerIds: next.map((b) => b.id) });
  }

  const selectedIds = new Set(selected?.map((b) => b.id) ?? []);
  const available = allBanners.filter((b) => !selectedIds.has(b.id) && b.status === "approved");

  return (
    <div className="admin-form-group">
      <label>Bölüme Özel Bannerlar (seçilmezse tüm onaylı bannerlar gösterilir)</label>
      {selected === null ? (
        <p style={{ fontSize: "0.85rem" }}>Yükleniyor...</p>
      ) : (
        <>
          {selected.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
              {selected.map((b, i) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={() => setDragIndex(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", background: "var(--admin-surface-2)", borderRadius: 6, padding: "4px 8px", opacity: dragIndex === i ? 0.4 : 1, cursor: "grab" }}
                >
                  <i className="fas fa-grip-vertical" style={{ color: "var(--admin-text-muted)" }} />
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ border: "none", background: "none", cursor: "pointer", lineHeight: 1 }}>
                      <i className="fas fa-caret-up" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} style={{ border: "none", background: "none", cursor: "pointer", lineHeight: 1 }}>
                      <i className="fas fa-caret-down" />
                    </button>
                  </span>
                  <span style={{ flex: 1 }}>{b.title}</span>
                  <button type="button" onClick={() => remove(b.id)} className="admin-btn admin-btn-danger admin-btn-sm">
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          )}
          {available.length > 0 && (
            <select
              className="admin-form-control"
              value=""
              onChange={(e) => e.target.value && add(Number(e.target.value))}
            >
              <option value="">Banner ekle...</option>
              {available.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}
