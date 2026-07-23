"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { ThreadMessage } from "@/lib/types";

export default function MessagesThread() {
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setThread(await fetchJson<ThreadMessage[]>("/vendor/messages"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await mutateJson("/vendor/messages", "POST", { message: draft.trim() });
      setDraft("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Yönetimle Mesajlaşma</h3>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 200, maxHeight: 420, overflowY: "auto" }}>
        {thread === null ? (
          <p>Yükleniyor...</p>
        ) : thread.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Henüz mesaj yok. Aşağıdan yönetime mesaj gönderebilirsiniz.</p>
        ) : (
          thread.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === "vendor" ? "flex-end" : "flex-start",
                background: m.sender === "vendor" ? "var(--pr)" : "var(--s2)",
                color: m.sender === "vendor" ? "#fff" : "var(--tx)",
                padding: "8px 14px",
                borderRadius: 12,
                maxWidth: "75%",
              }}
            >
              {m.message}
            </div>
          ))
        )}
      </div>
      <div className="card-body" style={{ display: "flex", gap: 8, paddingTop: 0 }}>
        <input
          className="fi"
          placeholder="Mesaj yaz..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button className="btn btn-pr" disabled={sending} onClick={handleSend}>
          Gönder
        </button>
      </div>
    </div>
  );
}
