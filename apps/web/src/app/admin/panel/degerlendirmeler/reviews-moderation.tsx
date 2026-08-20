"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminPendingReview } from "@/lib/types";
import StarRating from "@/components/star-rating";

const FILTERS: { value: AdminPendingReview["status"] | ""; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Onay Bekleyen" },
  { value: "approved", label: "Yayında" },
];

export default function ReviewsModeration() {
  const [data, setData] = useState<{ items: AdminPendingReview[]; counts: Record<string, number> } | null>(null);
  const [status, setStatus] = useState<AdminPendingReview["status"] | "">("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const qs = status ? `?status=${status}` : "";
    setData(await fetchJson(`/admin/reviews${qs}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function moderate(id: number, action: "approve" | "reject" | "unapprove") {
    setBusyId(id);
    try {
      await mutateJson(`/admin/reviews/${id}`, "PATCH", { action });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu değerlendirme silinsin mi?")) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/reviews/${id}`, "DELETE");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Değerlendirmeler</h2>
        <div className="quick-actions">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={status === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
              onClick={() => setStatus(f.value)}
            >
              {f.label} {f.value && data?.counts[f.value] ? `(${data.counts[f.value]})` : ""}
            </button>
          ))}
        </div>
      </div>
      {data === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : data.items.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-star" />
          <h3>Bu filtrede değerlendirme yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {data.items.map((r) => (
            <div key={r.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <div>
                  <a href={`/${r.productSlug}`} target="_blank" rel="noreferrer" style={{ color: "var(--admin-primary)", fontWeight: 700, fontSize: "0.85rem" }}>
                    {r.productName}
                  </a>
                  <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: 2 }}>
                    {r.customerName} · {r.vendorStoreName} · {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StarRating value={r.rating} />
                  <div style={{ marginTop: 4 }}>
                    <span className={`admin-badge admin-badge-${r.status === "approved" ? "active" : r.status === "rejected" ? "cancelled" : "pending"}`}>
                      {r.status === "approved" ? "Yayında" : r.status === "rejected" ? "Reddedildi" : "Onay Bekliyor"}
                    </span>
                  </div>
                </div>
              </div>
              {r.comment && <p>{r.comment}</p>}
              {r.vendorReply && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--admin-surface-2)", borderRadius: 8, fontSize: "0.8rem" }}>
                  <strong style={{ color: "var(--admin-primary)" }}><i className="fas fa-store" /> Satıcı yanıtı:</strong> {r.vendorReply}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                {r.status === "approved" ? (
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => moderate(r.id, "unapprove")} disabled={busyId === r.id}>
                    Yayından Kaldır
                  </button>
                ) : (
                  <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => moderate(r.id, "approve")} disabled={busyId === r.id}>
                    Onayla
                  </button>
                )}
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(r.id)} disabled={busyId === r.id}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
