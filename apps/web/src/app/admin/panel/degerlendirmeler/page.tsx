"use client";

import { useState } from "react";
import ReviewsModeration from "./reviews-moderation";
import QuestionsModeration from "./questions-moderation";
import VendorReviewsModeration from "./vendor-reviews-moderation";
import ComplaintsModeration from "./complaints-moderation";

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<"reviews" | "questions" | "vendorReviews" | "complaints">("reviews");

  return (
    <div>
      <div className="tab-nav">
        <button className={`tab-btn${tab === "reviews" ? " active" : ""}`} onClick={() => setTab("reviews")}>
          <i className="fas fa-star" /> Ürün Değerlendirmeleri
        </button>
        <button className={`tab-btn${tab === "vendorReviews" ? " active" : ""}`} onClick={() => setTab("vendorReviews")}>
          <i className="fas fa-store" /> Mağaza Değerlendirmeleri
        </button>
        <button className={`tab-btn${tab === "questions" ? " active" : ""}`} onClick={() => setTab("questions")}>
          <i className="fas fa-question-circle" /> Sorular
        </button>
        <button className={`tab-btn${tab === "complaints" ? " active" : ""}`} onClick={() => setTab("complaints")}>
          <i className="fas fa-flag" /> Şikayetler
        </button>
      </div>
      {tab === "reviews" && <ReviewsModeration />}
      {tab === "vendorReviews" && <VendorReviewsModeration />}
      {tab === "questions" && <QuestionsModeration />}
      {tab === "complaints" && <ComplaintsModeration />}
    </div>
  );
}
