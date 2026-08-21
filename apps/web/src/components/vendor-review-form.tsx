"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";

export default function VendorReviewForm({ vendorSlug, loggedIn }: { vendorSlug: string; loggedIn: boolean }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <p style={{ fontSize: "0.85rem" }}>
        <a href={`/giris?redirect=/${vendorSlug}`}>Giriş yapın</a> ve bu mağazayı değerlendirin.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Lütfen bir puan seçin");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await mutateJson(`/vendors/${vendorSlug}/reviews`, "POST", { rating, comment: comment || undefined });
      setMessage("Değerlendirmeniz gönderildi, onaylandıktan sonra yayınlanacak.");
      setRating(0);
      setComment("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Değerlendirme gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="review-form-box" onSubmit={handleSubmit}>
      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Bu Mağazayı Değerlendirin</div>
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
        placeholder="Mağaza deneyiminiz hakkında..."
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <p style={{ fontSize: "0.72rem", color: "var(--color-text-light)", margin: "0.4rem 0" }}>
        Yorumunuz incelendikten sonra yayınlanır. Hakaret, reklam, iletişim bilgisi içeren veya mağazayla ilgisiz yorumlar yayınlanmaz.
      </p>
      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: "0.85rem", color: "var(--color-success)" }}>{message}</p>}
      <button className="btn btn-sm" type="submit" disabled={loading}>
        {loading ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
      </button>
    </form>
  );
}
