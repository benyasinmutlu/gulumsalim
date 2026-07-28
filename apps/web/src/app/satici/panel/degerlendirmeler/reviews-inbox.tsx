"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorReview } from "@/lib/types";
import StarRating from "@/components/star-rating";

export default function ReviewsInbox() {
  const [reviews, setReviews] = useState<VendorReview[] | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setReviews(await fetchJson<VendorReview[]>("/vendor/reviews"));
  }

  useEffect(() => {
    load();
  }, []);

  async function submitReply(id: number) {
    if (draftReply.trim().length === 0) return;
    setBusyId(id);
    try {
      await mutateJson(`/vendor/reviews/${id}`, "PATCH", { reply: draftReply.trim() });
      setDraftId(null);
      setDraftReply("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const avg = reviews && reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <div className="card">
      <div className="ch" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Ürün Değerlendirmeleri</h3>
        {avg !== null && (
          <span style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>
            <StarRating value={avg} /> {avg.toFixed(1)} ({reviews?.length} değerlendirme)
          </span>
        )}
      </div>
      {reviews === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : reviews.length === 0 ? (
        <div className="empty">
          <i className="fas fa-star" />
          <p>Henüz bir değerlendirmeniz yok.</p>
        </div>
      ) : (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ border: "1px solid var(--bd)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <strong>
                  {r.customerName} <span style={{ fontWeight: 400, color: "var(--tx3)" }}>· {r.productName}</span>
                </strong>
                <StarRating value={r.rating} />
              </div>
              {r.comment && <p style={{ fontSize: "0.9rem" }}>{r.comment}</p>}
              <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 4 }}>{new Date(r.createdAt).toLocaleDateString("tr-TR")}</div>

              {r.vendorReply ? (
                <div style={{ marginTop: 10, background: "var(--s2)", borderRadius: 8, padding: 10 }}>
                  <strong style={{ fontSize: 12 }}>
                    <i className="fas fa-store" /> Yanıtınız:
                  </strong>
                  <p style={{ fontSize: "0.85rem", marginTop: 4 }}>{r.vendorReply}</p>
                </div>
              ) : draftId === r.id ? (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    className="fi"
                    rows={2}
                    placeholder="Yanıtınızı yazın..."
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                  />
                  <button className="btn btn-pr btn-sm" style={{ marginTop: 8 }} disabled={busyId === r.id} onClick={() => submitReply(r.id)}>
                    {busyId === r.id ? "Gönderiliyor..." : "Yanıtla"}
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-sec btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setDraftId(r.id);
                    setDraftReply("");
                  }}
                >
                  Yanıtla
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
