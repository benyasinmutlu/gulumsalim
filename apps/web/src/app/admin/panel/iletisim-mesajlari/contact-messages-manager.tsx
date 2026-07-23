"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { ContactMessage } from "@/lib/types";

export default function ContactMessagesManager() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);

  async function load() {
    setMessages(await fetchJson<ContactMessage[]>("/admin/contact-messages"));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: number) {
    await mutateJson(`/admin/contact-messages/${id}`, "PATCH");
    await load();
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>İletişim Mesajları</h2>
      </div>
      {messages === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : messages.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-envelope" />
          <h3>Mesaj yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: "var(--admin-radius)",
                padding: "16px",
                opacity: m.isRead ? 0.65 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <strong>
                  {m.name} · <span style={{ fontWeight: 400, color: "var(--admin-text-muted)" }}>{m.email}</span>
                </strong>
                <span style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{new Date(m.createdAt).toLocaleDateString("tr-TR")}</span>
              </div>
              <p style={{ marginBottom: 10 }}>{m.message}</p>
              {!m.isRead && (
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => markRead(m.id)}>
                  Okundu İşaretle
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
