"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";

const SHOW_AFTER_MS = 45_000;
const DISMISS_STORAGE_KEY = "gs_feedback_dismissed_at";
const SENT_STORAGE_KEY = "gs_feedback_sent";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const CATEGORY_OPTIONS = [
  { value: "elestiri", label: "Eleştiri" },
  { value: "oneri", label: "Öneri" },
  { value: "sikayet", label: "Şikayet" },
  { value: "diger", label: "Diğer" },
];

// bkz. kullanıcı isteği: "websitesine her giren kişiye eğer belirli bir
// süre kaldıysa değerlendirme yeri çıkartalım ona tıklayıp bizi
// değerlendirsin eleştiri öneri şikayette bulunsun" - sitede
// SHOW_AFTER_MS kadar kalan (client-side navigasyonlar dahil, layout hiç
// unmount olmadığı için sayaç kesintisiz devam eder) her ziyaretçiye
// sağ altta küçük bir davet kartı çıkar. Daha önce gönderdiyse bir daha
// hiç, kapattıysa 24 saat boyunca tekrar gösterilmez.
// Checkout akışında dikkat dağıtmaması için /odeme ve /sepet'te hiç
// gösterilmez.
const SUPPRESSED_PATHS = ["/odeme", "/sepet"];

export default function SiteFeedbackWidget() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]!.value);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SENT_STORAGE_KEY)) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return;

    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    setVisible(false);
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Lütfen en az birkaç kelime yazın");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/site-feedback", "POST", {
        rating: rating || undefined,
        category,
        message: message.trim(),
        pageUrl: window.location.pathname,
      });
      localStorage.setItem(SENT_STORAGE_KEY, "1");
      setSent(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Gönderilemedi, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  if (!visible || SUPPRESSED_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="site-feedback-widget">
      {!open ? (
        <button type="button" className="site-feedback-teaser" onClick={() => setOpen(true)}>
          <i className="fas fa-comment-dots" />
          <span>Deneyiminizi değerlendirin</span>
          <span
            className="site-feedback-close"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
          >
            <i className="fas fa-times" />
          </span>
        </button>
      ) : sent ? (
        <div className="site-feedback-panel">
          <div className="site-feedback-panel-head">
            <span>Teşekkürler!</span>
            <button type="button" onClick={dismiss}>
              <i className="fas fa-times" />
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-light)" }}>Geri bildiriminiz bize ulaştı.</p>
        </div>
      ) : (
        <form className="site-feedback-panel" onSubmit={handleSubmit}>
          <div className="site-feedback-panel-head">
            <span>Bizi Değerlendirin</span>
            <button type="button" onClick={dismiss}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="star-rating-input" style={{ marginBottom: 8 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`${s} yıldız`}
                onClick={() => setRating(s)}
                style={{ color: s <= rating ? "#f5a623" : "#ddd" }}
              >
                <i className="fas fa-star" />
              </button>
            ))}
          </div>
          <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: 13, marginBottom: 8 }}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Eleştiri, öneri ya da şikayetinizi yazın..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ fontSize: 13, marginBottom: 8 }}
          />
          {error && <p className="error-text" style={{ fontSize: 12 }}>{error}</p>}
          <button className="btn btn-sm" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Gönderiliyor..." : "Gönder"}
          </button>
        </form>
      )}
    </div>
  );
}
