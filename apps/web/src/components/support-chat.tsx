"use client";

import { useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  reply: string;
  aiAvailable: boolean;
}

// Yardım & Destek sayfasındaki AI destekli sohbet kutusu - backend
// apps/api/src/modules/support/support.routes.ts'deki /support/chat ucunu
// çağırır, mevcut LLM client'ı (ürün zekası modülüyle paylaşılan) kullanır.
export default function SupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await mutateJson<ChatResponse>("/support/chat", "POST", {
        message: text,
        history: messages.slice(-6),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Mesaj gönderilemedi, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "var(--color-bg-alt)", fontWeight: 700, fontSize: "0.9rem" }}>
        <i className="fas fa-comments" style={{ color: "var(--color-primary)" }} /> Destek Asistanı
      </div>

      <div style={{ padding: 16, minHeight: 160, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)", margin: 0 }}>
            Merhaba! Kargo, iade, ödeme veya satıcı olma hakkında bana soru sorabilirsin.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "var(--color-primary)" : "var(--color-bg-alt)",
              color: m.role === "user" ? "#fff" : "var(--color-text)",
              borderRadius: 12,
              padding: "8px 12px",
              maxWidth: "85%",
              fontSize: "0.85rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && <p style={{ fontSize: "0.8rem", color: "var(--color-text-light)", margin: 0 }}>Yazıyor...</p>}
        {error && <p className="error-text" style={{ fontSize: "0.8rem" }}>{error}</p>}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--color-border)" }}>
        <input
          className="form-control"
          placeholder="Bir soru yazın..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          style={{ flex: 1 }}
        />
        <button className="btn btn-sm btn-pr" type="submit" disabled={loading || !input.trim()}>
          Gönder
        </button>
      </form>
    </div>
  );
}
