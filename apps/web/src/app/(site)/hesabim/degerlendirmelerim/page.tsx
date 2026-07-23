import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { CustomerQuestion, CustomerReview } from "@/lib/types";
import StarRating from "@/components/star-rating";

async function getReviews(): Promise<CustomerReview[]> {
  try {
    return await apiFetchJson<CustomerReview[]>("/my/reviews");
  } catch {
    return [];
  }
}

async function getQuestions(): Promise<CustomerQuestion[]> {
  try {
    return await apiFetchJson<CustomerQuestion[]>("/my/questions");
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<CustomerReview["status"], string> = {
  pending: "Onay Bekliyor",
  approved: "Yayınlandı",
  rejected: "Reddedildi",
};

export default async function CustomerReviewsPage() {
  const [reviews, questions] = await Promise.all([getReviews(), getQuestions()]);

  return (
    <div className="form-card">
      <h3>Değerlendirmelerim</h3>
      {reviews.length === 0 ? (
        <p style={{ fontSize: "0.9rem" }}>Henüz hiç değerlendirme yazmadınız.</p>
      ) : (
        <div className="review-list">
          {reviews.map((r) => (
            <div key={r.id} className="review-card">
              <div className="review-card-head">
                <Link href={`/urun/${r.productSlug}`}>
                  <strong>{r.productName}</strong>
                </Link>
                <StarRating value={r.rating} />
              </div>
              {r.comment && <p>{r.comment}</p>}
              <div className="review-card-date">
                {new Date(r.createdAt).toLocaleDateString("tr-TR")} · {STATUS_LABEL[r.status]}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: "2rem" }}>Sorularım</h3>
      {questions.length === 0 ? (
        <p style={{ fontSize: "0.9rem" }}>Henüz hiç soru sormadınız.</p>
      ) : (
        <div className="review-list">
          {questions.map((q) => (
            <div key={q.id} className="review-card">
              <Link href={`/urun/${q.productSlug}`}>
                <strong>{q.productName}</strong>
              </Link>
              <p>{q.question}</p>
              {q.answer ? (
                <div className="review-vendor-reply">
                  <strong>
                    <i className="fas fa-store" /> Satıcı Yanıtı:
                  </strong>
                  <p>{q.answer}</p>
                </div>
              ) : (
                <div className="review-card-date">Henüz yanıtlanmadı</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
