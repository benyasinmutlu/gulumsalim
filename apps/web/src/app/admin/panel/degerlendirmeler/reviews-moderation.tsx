"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminPendingReview } from "@/lib/types";
import StarRating from "@/components/star-rating";

export default function ReviewsModeration() {
  const [reviews, setReviews] = useState<AdminPendingReview[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setReviews(await fetchJson<AdminPendingReview[]>("/admin/reviews"));
  }

  useEffect(() => {
    load();
  }, []);

  async function moderate(id: number, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await mutateJson(`/admin/reviews/${id}`, "PATCH", { action });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Onay Bekleyen Değerlendirmeler</h2>
      </div>
      {reviews === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : reviews.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-star" />
          <h3>Onay bekleyen değerlendirme yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>
                  {r.customerName} · <span style={{ fontWeight: 400, color: "var(--admin-text-muted)" }}>{r.productName}</span>
                </strong>
                <StarRating value={r.rating} />
              </div>
              {r.comment && <p>{r.comment}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => moderate(r.id, "approve")} disabled={busyId === r.id}>
                  Onayla
                </button>
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => moderate(r.id, "reject")} disabled={busyId === r.id}>
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
