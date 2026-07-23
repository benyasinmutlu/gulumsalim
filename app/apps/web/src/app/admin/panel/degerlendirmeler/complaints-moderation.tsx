"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminVendorComplaintRow } from "@/lib/types";

const REASON_LABEL: Record<string, string> = {
  sahte_urun: "Sahte Ürün",
  gec_teslimat: "Geç Teslimat",
  kotu_iletisim: "Kötü İletişim",
  hatali_urun: "Hatalı/Eksik Ürün",
  diger: "Diğer",
};

const STATUS_LABEL: Record<AdminVendorComplaintRow["status"], string> = {
  pending: "İnceleniyor",
  reviewed: "İncelendi",
  dismissed: "Reddedildi",
};

// bkz. kullanıcı isteği: "mağazayı şikayet et bölümü ekleyelim" - admin
// tarafındaki inceleme kuyruğu, vendor-reviews-moderation.tsx ile aynı desen.
export default function ComplaintsModeration() {
  const [complaints, setComplaints] = useState<AdminVendorComplaintRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  async function load() {
    setComplaints(await fetchJson<AdminVendorComplaintRow[]>("/admin/vendor-complaints"));
  }

  useEffect(() => {
    load();
  }, []);

  async function moderate(id: number, action: "review" | "dismiss") {
    setBusyId(id);
    try {
      await mutateJson(`/admin/vendor-complaints/${id}`, "PATCH", { action });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = complaints?.filter((c) => showResolved || c.status === "pending") ?? null;

  return (
    <div className="admin-card">
      <div className="admin-card-header" style={{ justifyContent: "space-between" }}>
        <h2>Mağaza Şikayetleri</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Sonuçlananları da göster
        </label>
      </div>
      {visible === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : visible.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-flag" />
          <h3>İnceleme bekleyen şikayet yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visible.map((c) => (
            <div key={c.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>
                  {c.vendorStoreName} · <span style={{ fontWeight: 400, color: "var(--admin-text-muted)" }}>{c.customerName}</span>
                </strong>
                <span className={`admin-badge admin-badge-${c.status === "pending" ? "pending" : c.status === "reviewed" ? "active" : "inactive"}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-primary)", marginBottom: 4 }}>
                {REASON_LABEL[c.reason] ?? c.reason}
              </div>
              <p>{c.message}</p>
              <div style={{ fontSize: 11, color: "var(--admin-text-muted)", marginTop: 4 }}>
                {new Date(c.createdAt).toLocaleString("tr-TR")}
              </div>
              {c.status === "pending" && (
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => moderate(c.id, "review")} disabled={busyId === c.id}>
                    İncelendi Olarak İşaretle
                  </button>
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => moderate(c.id, "dismiss")} disabled={busyId === c.id}>
                    Reddet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
