"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminSiteFeedbackRow } from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  elestiri: "Eleştiri",
  oneri: "Öneri",
  sikayet: "Şikayet",
  diger: "Diğer",
};

// bkz. kullanıcı isteği: "websitesine her giren kişiye ... değerlendirme
// yeri çıkartalım ona tıklayıp bizi değerlendirsin eleştiri öneri
// şikayette bulunsun" - admin tarafındaki okuma listesi.
export default function SiteFeedbackManager() {
  const [rows, setRows] = useState<AdminSiteFeedbackRow[] | null>(null);

  async function load() {
    setRows(await fetchJson<AdminSiteFeedbackRow[]>("/admin/site-feedback"));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: number) {
    await mutateJson(`/admin/site-feedback/${id}`, "PATCH");
    await load();
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Site Geri Bildirimleri</h2>
      </div>
      {rows === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-comment-dots" />
          <h3>Henüz geri bildirim yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {rows.map((r) => (
            <div
              key={r.id}
              onClick={() => !r.isRead && markRead(r.id)}
              style={{
                background: r.isRead ? "var(--admin-bg)" : "var(--admin-primary-light)",
                border: "1px solid var(--admin-border)",
                borderRadius: "var(--admin-radius)",
                padding: "16px",
                cursor: r.isRead ? "default" : "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {r.category && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-primary)" }}>
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </span>
                  )}
                  {r.rating && (
                    <span style={{ fontSize: 12, color: "#f5a623" }}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>{new Date(r.createdAt).toLocaleString("tr-TR")}</span>
              </div>
              <p style={{ margin: 0 }}>{r.message}</p>
              {r.pageUrl && <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 6 }}>{r.pageUrl}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
