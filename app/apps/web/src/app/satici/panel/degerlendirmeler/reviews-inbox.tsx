"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorReview } from "@/lib/types";
import StarRating from "@/components/star-rating";

type RatingFilter = "all" | "positive" | "negative" | "unanswered" | 1 | 2 | 3 | 4 | 5;
type SortKey = "newest" | "lowest" | "highest";

export default function ReviewsInbox() {
  const [reviews, setReviews] = useState<VendorReview[] | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [productFilter, setProductFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

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

  // 100+ ürünün yorumları düz bir listede scroll etmek yerine: özet (ortalama +
  // puan dağılımı), filtreler (olumsuz/cevapsız/puan/ürün) ve sıralama ile
  // yönetilebilir hale getirilir - hepsi istemci tarafında (backend değişmez).
  const summary = useMemo(() => {
    const list = reviews ?? [];
    const dist = [0, 0, 0, 0, 0]; // idx 0 = 1 yıldız ... idx 4 = 5 yıldız
    let sum = 0;
    let unanswered = 0;
    let negative = 0;
    for (const r of list) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      dist[star - 1]++;
      sum += r.rating;
      if (!r.vendorReply) unanswered++;
      if (r.rating <= 2) negative++;
    }
    const total = list.length;
    return {
      total,
      avg: total ? sum / total : 0,
      dist,
      unanswered,
      negative,
      positivePct: total ? Math.round((list.filter((r) => r.rating >= 4).length / total) * 100) : 0,
    };
  }, [reviews]);

  const products = useMemo(() => {
    const m = new Map<number, { name: string; count: number; sum: number }>();
    for (const r of reviews ?? []) {
      const e = m.get(r.productId) ?? { name: r.productName, count: 0, sum: 0 };
      e.count++;
      e.sum += r.rating;
      m.set(r.productId, e);
    }
    return [...m.entries()]
      .map(([id, e]) => ({ id, name: e.name, count: e.count, avg: e.sum / e.count }))
      .sort((a, b) => b.count - a.count);
  }, [reviews]);

  const visible = useMemo(() => {
    let list = [...(reviews ?? [])];
    if (productFilter !== "all") list = list.filter((r) => r.productId === productFilter);
    if (ratingFilter === "positive") list = list.filter((r) => r.rating >= 4);
    else if (ratingFilter === "negative") list = list.filter((r) => r.rating <= 2);
    else if (ratingFilter === "unanswered") list = list.filter((r) => !r.vendorReply);
    else if (typeof ratingFilter === "number") list = list.filter((r) => Math.round(r.rating) === ratingFilter);
    list.sort((a, b) => {
      if (sort === "lowest") return a.rating - b.rating;
      if (sort === "highest") return b.rating - a.rating;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    });
    return list;
  }, [reviews, productFilter, ratingFilter, sort]);

  const filterChips: [RatingFilter, string][] = [
    ["all", "Tümü"],
    ["negative", `Olumsuz (${summary.negative})`],
    ["unanswered", `Cevapsız (${summary.unanswered})`],
    [5, "5★"],
    [4, "4★"],
    [3, "3★"],
    [2, "2★"],
    [1, "1★"],
  ];

  return (
    <div>
      {reviews && reviews.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{summary.avg.toFixed(1)}</div>
              <StarRating value={summary.avg} />
              <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 4 }}>{summary.total} değerlendirme</div>
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.dist[star - 1] ?? 0;
                const pct = summary.total ? (count / summary.total) * 100 : 0;
                return (
                  <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, width: 28, color: "var(--tx3)" }}>{star}★</span>
                    <div style={{ flex: 1, height: 8, background: "var(--s2)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: star >= 4 ? "var(--ok)" : star === 3 ? "var(--wa)" : "var(--er)" }} />
                    </div>
                    <span style={{ fontSize: 12, width: 32, textAlign: "right", color: "var(--tx3)" }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ok)" }}>%{summary.positivePct}</div>
                <div style={{ fontSize: 11, color: "var(--tx3)" }}>olumlu</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--er)" }}>{summary.negative}</div>
                <div style={{ fontSize: 11, color: "var(--tx3)" }}>olumsuz</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--wa)" }}>{summary.unanswered}</div>
                <div style={{ fontSize: 11, color: "var(--tx3)" }}>cevapsız</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ch" style={{ flexWrap: "wrap", gap: 8 }}>
          <h3>Ürün Değerlendirmeleri</h3>
          {reviews && reviews.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="fi" style={{ width: "auto", padding: "6px 28px 6px 10px", fontSize: 12 }} value={productFilter} onChange={(e) => setProductFilter(e.target.value === "all" ? "all" : Number(e.target.value))}>
                <option value="all">Tüm ürünler ({products.length})</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.avg.toFixed(1)}★ ({p.count})
                  </option>
                ))}
              </select>
              <select className="fi" style={{ width: "auto", padding: "6px 28px 6px 10px", fontSize: 12 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="newest">En yeni</option>
                <option value="lowest">En düşük puan</option>
                <option value="highest">En yüksek puan</option>
              </select>
            </div>
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
          <>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "12px 20px 0" }}>
              {filterChips.map(([k, label]) => (
                <button
                  key={String(k)}
                  type="button"
                  className={`btn btn-sm ${ratingFilter === k ? "btn-pr" : "btn-sec"}`}
                  onClick={() => setRatingFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {visible.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Bu filtrede değerlendirme yok.</p>
              ) : (
                visible.map((r) => (
                  <div key={r.id} style={{ border: "1px solid var(--br)", borderRadius: 12, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
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
                        <textarea className="fi" rows={2} placeholder="Yanıtınızı yazın..." value={draftReply} onChange={(e) => setDraftReply(e.target.value)} />
                        <button className="btn btn-pr btn-sm" style={{ marginTop: 8 }} disabled={busyId === r.id} onClick={() => submitReply(r.id)}>
                          {busyId === r.id ? "Gönderiliyor..." : "Yanıtla"}
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-sec btn-sm" style={{ marginTop: 10 }} onClick={() => { setDraftId(r.id); setDraftReply(""); }}>
                        Yanıtla
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
