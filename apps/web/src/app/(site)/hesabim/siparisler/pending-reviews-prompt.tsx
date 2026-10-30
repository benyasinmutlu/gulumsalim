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
      <div className="pending-review-body">
        <Link href={`/urun/${item.productSlug}`} className="pending-review-name">
          {item.productName}
        </Link>
        <div className="pending-review-order">Sipariş: {item.orderNumber}</div>
        <form onSubmit={handleSubmit} className="pending-review-form">
          <div className="star-rating-input">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`${s} yıldız`}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className={s <= (hoverRating || rating) ? "star-filled" : "star-empty"}
              >
                <i className="fas fa-star" />
              </button>
            ))}
          </div>
          <textarea
            className="form-control pending-review-textarea"
            placeholder="Ürün hakkındaki düşünceleriniz (isteğe bağlı)..."
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {error && <p className="error-text error-text-sm">{error}</p>}
          <button className="btn btn-sm pending-review-submit" type="submit" disabled={loading}>
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
      <div className="pending-reviews-head">
        <h3>
          <i className="fas fa-star" /> Değerlendirmenizi Bekleyen Ürünler
        </h3>
        <button type="button" onClick={() => setDismissed(true)} aria-label="Kapat" className="pending-reviews-close">
          <i className="fas fa-xmark" />
        </button>
      </div>
      <p className="pending-reviews-desc">
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
