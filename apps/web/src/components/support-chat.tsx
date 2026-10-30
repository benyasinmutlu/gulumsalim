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
    <div className="support-chat">
      <div className="support-chat-head">
        <i className="fas fa-comments" /> Destek Asistanı
      </div>

      <div className="support-chat-body">
        {messages.length === 0 && (
          <p className="support-chat-empty">Merhaba! Kargo, iade, ödeme veya satıcı olma hakkında bana soru sorabilirsin.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`support-chat-bubble ${m.role === "user" ? "user" : "assistant"}`}>
            {m.content}
          </div>
        ))}
        {loading && <p className="support-chat-typing">Yazıyor...</p>}
        {error && <p className="error-text support-chat-typing">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="support-chat-form">
        <input
          className="form-control"
          placeholder="Bir soru yazın..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
        />
        <button className="btn btn-sm btn-pr" type="submit" disabled={loading || !input.trim()}>
          Gönder
        </button>
      </form>
    </div>
  );
}
