"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "@/lib/client-api";

export default function QuestionForm({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <p style={{ fontSize: "0.85rem" }}>
        <a href={`/giris?redirect=/urun/${slug}`}>Giriş yapın</a> ve satıcıya soru sorun.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await mutateJson(`/products/${slug}/questions`, "POST", { question });
      setMessage("Sorunuz satıcıya iletildi.");
      setQuestion("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Soru gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="review-form-box" onSubmit={handleSubmit}>
      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Satıcıya Soru Sor</div>
      <textarea
        className="form-control"
        placeholder="Sorunuzu yazın..."
        rows={3}
        required
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: "0.85rem", color: "var(--color-success)" }}>{message}</p>}
      <button className="btn btn-sm" type="submit" disabled={loading}>
        {loading ? "Gönderiliyor..." : "Soruyu Gönder"}
      </button>
    </form>
  );
}
