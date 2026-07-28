"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import type { PendingReviewItem } from "@/lib/types";

function ReviewCard({ item, onDone }: { item: PendingReviewItem; onDone: (orderItemId: number) => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Lütfen bir puan seçin");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson(`/products/${item.productSlug}/reviews`, "POST", { rating, comment: comment || undefined });
      onDone(item.orderItemId);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Değerlendirme gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pending-review-card">
      <Link href={`/urun/${item.productSlug}`} className="pending-review-thumb">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.productName} />
        ) : (
          <i className="fas fa-image" />
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/urun/${item.productSlug}`} className="pending-review-name">
          {item.productName}
        </Link>
        <div style={{ fontSize: 12, color: "var(--color-text-light)", marginBottom: 8 }}>Sipariş: {item.orderNumber}</div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="star-rating-input">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`${s} yıldız`}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                style={{ color: s <= (hoverRating || rating) ? "#f5a623" : "#ddd" }}
              >
                <i className="fas fa-star" />
              </button>
            ))}
          </div>
          <textarea
            className="form-control"
            placeholder="Ürün hakkındaki düşünceleriniz (isteğe bağlı)..."
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ fontSize: 13 }}
          />
          {error && <p className="error-text" style={{ fontSize: 12 }}>{error}</p>}
          <button className="btn btn-sm" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PendingReviewsPrompt({ items }: { items: PendingReviewItem[] }) {
  const [pending, setPending] = useState(items);
  const [dismissed, setDismissed] = useState(false);

  if (pending.length === 0 || dismissed) return null;

  function handleDone(orderItemId: number) {
    setPending((prev) => prev.filter((p) => p.orderItemId !== orderItemId));
  }

  return (
    <div className="form-card pending-reviews-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <h3>
          <i className="fas fa-star" style={{ color: "#f5a623" }} /> Değerlendirmenizi Bekleyen Ürünler
        </h3>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Kapat"
          style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "var(--color-text-light)" }}
        >
          <i className="fas fa-xmark" />
        </button>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)", marginBottom: 16 }}>
        Teslim aldığınız bu ürünler hakkında görüşlerinizi paylaşarak diğer alıcılara yardımcı olabilirsiniz.
      </p>
      <div className="pending-reviews-grid">
        {pending.map((item) => (
          <ReviewCard key={item.orderItemId} item={item} onDone={handleDone} />
        ))}
      </div>
    </div>
  );
}
