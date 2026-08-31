"use client";

import { useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

// bkz. denetim raporu madde 18: "Faydalı soru-cevapların ürün sayfasında
// yayınlanması" - FollowButton/FavoriteButton ile aynı desen (iyimser UI,
// 401'de girişe yönlendirme).
export default function QuestionHelpfulButton({
  slug,
  questionId,
  initialCount,
  initialVoted,
}: {
  slug: string;
  questionId: number;
  initialCount: number;
  initialVoted: boolean;
}) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await mutateJson<{ voted: boolean }>(`/products/${slug}/questions/${questionId}/helpful`, "POST");
      setVoted(result.voted);
      setCount((c) => c + (result.voted ? 1 : -1));
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        window.location.href = `/giris?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={`question-helpful-btn${voted ? " active" : ""}`} onClick={handleClick} disabled={loading}>
      <i className={voted ? "fas fa-thumbs-up" : "far fa-thumbs-up"} /> Faydalı{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
