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
};

export default function StoreLayoutForm() {
  const [sections, setSections] = useState<VendorStoreLayoutSection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<VendorStoreLayoutSection[]>("/vendor/store-layout").then(setSections);
  }, []);

  function toggle(type: VendorStoreLayoutSection["type"]) {
    setSections((prev) => prev?.map((s) => (s.type === type ? { ...s, visible: !s.visible } : s)) ?? null);
  }

  function move(index: number, direction: -1 | 1) {
    setSections((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleSave() {
    if (!sections) return;
    setSaving(true);
    setMessage(null);
    try {
      await mutateJson("/vendor/store-layout", "PATCH", { sections });
      setMessage("Kaydedildi.");
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--s2)",
                  borderRadius: 10,
                }}
              >
                <span style={{ flex: 1 }}>{SECTION_LABEL[s.type]}</span>
                <button className="btn-icon" onClick={() => move(i, -1)} disabled={i === 0}>
                  <i className="fas fa-arrow-up" />
                </button>
                <button className="btn-icon" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>
                  <i className="fas fa-arrow-down" />
                </button>
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
