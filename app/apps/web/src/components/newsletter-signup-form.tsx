"use client";

import { useState } from "react";

// Footer bülten kayıt bandı - contact/cookie-consent ile aynı gerekçeyle
// düz fetch kullanılır (bkz. lib/cookie-consent.ts): backend bu uçta CSRF
// kontrolü yapmıyor, misafir ziyaretçi de kaydolabilsin diye.
export default function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter-signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="newsletter-done">
        <i className="fas fa-check-circle" /> Teşekkürler! Bültenimize kaydoldunuz.
      </p>
    );
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubmit}>
      <input
        type="email"
        required
        placeholder="E-posta adresiniz"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Gönderiliyor..." : "Abone Ol"}
      </button>
      {status === "error" && <p className="newsletter-error">Bir hata oluştu, lütfen tekrar deneyin.</p>}
    </form>
  );
}
