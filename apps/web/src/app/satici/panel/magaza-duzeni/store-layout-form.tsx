"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorStoreLayoutSection } from "@/lib/types";

const SECTION_LABEL: Record<VendorStoreLayoutSection["type"], string> = {
  collections: "Koleksiyonlar",
  products: "Ürünler",
  about: "Hakkımızda",
  slider: "Slider",
  social: "Sosyal Medya Gönderileri",
  discount: "İndirimli Ürünler Vitrini",
  favorites: "Sevdikleriniz",
  recently_viewed: "Son Baktıklarınız",
};

interface Props {
  onSaved?: () => void;
}

export default function StoreLayoutForm({ onSaved }: Props) {
  const [sections, setSections] = useState<VendorStoreLayoutSection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchJson<VendorStoreLayoutSection[]>("/vendor/store-layout").then(setSections);
  }, []);

  function toggle(type: VendorStoreLayoutSection["type"]) {
    setSections((prev) => prev?.map((s) => (s.type === type ? { ...s, visible: !s.visible } : s)) ?? null);
  }

  // Admin anasayfa-bölümleri sürükle-bırak sıralamasıyla aynı desen -
  // yukarı/aşağı ok tuşlarından daha hızlı, tüm listeyi tek harekette
  // yeniden sıralar (bkz. kullanıcı isteği: "yeni özellikler ekle").
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(targetIndex: number) {
    setDragOverIndex(null);
    setSections((prev) => {
      if (dragIndex === null || !prev || dragIndex === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved!);
      return next;
    });
    setDragIndex(null);
  }

  async function handleSave() {
    if (!sections) return;
    setSaving(true);
    setMessage(null);
    try {
      await mutateJson("/vendor/store-layout", "PATCH", { sections });
      setMessage("Kaydedildi.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Mağaza Düzeni</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: "0.85rem", color: "var(--tx3)", marginBottom: 16 }}>
          Mağaza profil sayfanızda bölümlerin sırasını ve görünürlüğünü ayarlayın.
        </p>
        {sections === null ? (
          <p>Yükleniyor...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sections.map((s, i) => (
              <div
                key={s.type}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(i, e)}
                onDrop={() => handleDrop(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--s2)",
                  borderRadius: 10,
                  cursor: "grab",
                  opacity: dragIndex === i ? 0.4 : 1,
                  borderTop: dragOverIndex === i && dragIndex !== null && dragIndex !== i ? "2px solid var(--pr)" : "2px solid transparent",
                }}
              >
                <i className="fas fa-grip-vertical" style={{ color: "var(--tx3)" }} />
                <span style={{ flex: 1 }}>{SECTION_LABEL[s.type]}</span>
                <label className="toggle">
                  <input type="checkbox" checked={s.visible} onChange={() => toggle(s.type)} />
                  <span className="slider" />
                </label>
              </div>
            ))}
          </div>
        )}
        {message && <p style={{ fontSize: "0.85rem", color: "var(--ok)", marginTop: 12 }}>{message}</p>}
        <button className="btn btn-pr" style={{ marginTop: 16 }} onClick={handleSave} disabled={saving || !sections}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </div>
  );
}
